package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"github.com/go-sql-driver/mysql"
	"net/http"
	"os"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"
)

type teamDataSaveRequest struct {
	ProtocolVersion int                 `json:"protocol_version"`
	Operations      []businessOperation `json:"operations"`
}

func (a *app) handleTeamDataLoad(w http.ResponseWriter, r *http.Request, auth authContext) {
	a.handleAppBootstrap(w, r, auth)
}

func (a *app) handleTeamDataSave(w http.ResponseWriter, r *http.Request, auth authContext) {
	var req teamDataSaveRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	for _, operation := range req.Operations {
		if failure := applyBusinessOperation(r.Context(), tx, auth, operation); failure.status != 0 {
			writeError(w, failure.status, failure.message)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.writeBootstrapRows(w, r, auth)
}

func versionedJSONBody(t *testing.T, raw string, _ int64) *bytes.Reader {
	t.Helper()
	var value map[string]any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return bytes.NewReader(body)
}

func mysqlRowRevision(t *testing.T, db *sql.DB, table string, id string) int64 {
	t.Helper()
	return 0
}

func testApp(t *testing.T) *app {
	t.Helper()
	return newApp(defaultConfig(), nil)
}
func mysqlSeededApp(t *testing.T) *app {
	t.Helper()
	dsn, cleanup := mysqlTestDSN(t)
	t.Cleanup(cleanup)
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})
	if err := seedMySQLStore(db, seededStore()); err != nil {
		t.Fatal(err)
	}
	return newApp(defaultConfig(), db)
}

func seedMySQLStore(db *sql.DB, seed store) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer mysqlRollback(tx)
	for _, workspace := range seed.Workspaces {
		if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
			return err
		}
	}
	for _, account := range seed.Accounts {
		if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
			return err
		}
		workspaceID := account.WorkspaceID
		role := "member"
		if workspace := seed.Workspaces[workspaceID]; workspace.OwnerAccountID == account.ID {
			role = "owner"
		}
		if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspaceID, account.ID, role, "active", account.UpdatedAt); err != nil {
			return err
		}
		if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, account.UpdatedAt); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func seededStore() store {
	return store{
		Version: 2,
		Workspaces: map[string]workspaceData{
			"workspace_test": {
				ID:             "workspace_test",
				Name:           "测试团队",
				Type:           "shared",
				OwnerAccountID: "account_owner",
				CreatedAt:      "2026-05-10T08:00:00Z",
				UpdatedAt:      "2026-05-10T08:00:00Z",
			},
		},
		Accounts: map[string]accountRecord{
			"account_owner": {
				ID:           "account_owner",
				WorkspaceID:  "workspace_test",
				Name:         "项目负责人",
				Email:        "owner@example.com",
				PasswordHash: "hash",
				CreatedAt:    "2026-05-10T08:00:00Z",
				UpdatedAt:    "2026-05-10T08:00:00Z",
			},
		},
	}
}
func ownerAuth() authContext {
	return authContext{AccountID: "account_owner", WorkspaceID: "workspace_test"}
}
func defaultAdminLoginPayload(t *testing.T, deviceID string) []byte {
	t.Helper()
	body, err := json.Marshal(map[string]string{
		"email":     defaultAdminUsername,
		"password":  defaultAdminPassword,
		"device_id": deviceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	return body
}
func defaultAdminLoginBody(t *testing.T, deviceID string) *bytes.Reader {
	t.Helper()
	return bytes.NewReader(defaultAdminLoginPayload(t, deviceID))
}

func saveRows(t *testing.T, api *app, auth authContext, _ string, rows []businessRow) teamDataResponse {
	t.Helper()
	current := loadRows(t, api, auth, 0)
	currentByKey := map[string]businessRow{}
	for _, row := range current.Rows {
		currentByKey[businessRowKey(row)] = row
	}
	operations := make([]businessOperation, 0, len(rows))
	for index := range rows {
		row := rows[index]
		if existing, found := currentByKey[businessRowKey(row)]; found {
			var existingPayload any
			var submittedPayload any
			if existing.UpdatedAt == row.UpdatedAt && json.Unmarshal(existing.Payload, &existingPayload) == nil && json.Unmarshal(row.Payload, &submittedPayload) == nil && reflect.DeepEqual(existingPayload, submittedPayload) {
				continue
			}
			operations = append(operations, businessOperation{
				Operation:   "patch",
				WorkspaceID: row.WorkspaceID,
				Entity:      row.Entity,
				ID:          row.ID,
				UpdatedAt:   row.UpdatedAt,
				Patch:       row.Payload,
			})
			continue
		}
		operations = append(operations, businessOperation{Operation: "create", Row: &row})
	}
	tx, err := api.db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer mysqlRollback(tx)
	for _, operation := range operations {
		if failure := applyBusinessOperation(context.Background(), tx, auth, operation); failure.status != 0 {
			t.Fatalf("save status = %d, message = %s", failure.status, failure.message)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	return loadRows(t, api, auth, 0)
}

func loadRows(t *testing.T, api *app, auth authContext, _ int64) teamDataResponse {
	t.Helper()
	rows, err := api.businessRowsForAccount(context.Background(), auth)
	if err != nil {
		t.Fatal(err)
	}
	return teamDataResponse{Rows: rows}
}
func mysqlTableExists(ctx context.Context, db *sql.DB, tableName string) (bool, error) {
	var count int
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
		tableName,
	).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}
func mysqlTestDSN(t *testing.T) (string, func()) {
	t.Helper()
	baseDSN := strings.TrimSpace(os.Getenv("TM_BACKEND_TEST_MYSQL_DSN"))
	if baseDSN == "" {
		t.Skip("set TM_BACKEND_TEST_MYSQL_DSN to run MySQL integration tests")
	}
	cfg, err := mysql.ParseDSN(baseDSN)
	if err != nil {
		t.Fatalf("invalid TM_BACKEND_TEST_MYSQL_DSN: %v", err)
	}
	if cfg.DBName == "" {
		t.Fatal("TM_BACKEND_TEST_MYSQL_DSN must include a database name")
	}
	dbName := "tm_test_" + strconv.FormatInt(time.Now().UnixNano(), 36)
	cfg.DBName = dbName
	dsn := cfg.FormatDSN()
	cleanup := func() {
		serverCfg := cfg
		serverCfg.DBName = ""
		serverDB, err := sql.Open("mysql", serverCfg.FormatDSN())
		if err != nil {
			t.Logf("cleanup mysql open failed: %v", err)
			return
		}
		defer serverDB.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := serverDB.ExecContext(ctx, "DROP DATABASE IF EXISTS `"+escapeMySQLIdentifier(dbName)+"`"); err != nil {
			t.Logf("cleanup mysql database %s failed: %v", dbName, err)
		}
	}
	return dsn, cleanup
}
