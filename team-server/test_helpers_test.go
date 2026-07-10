package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/go-sql-driver/mysql"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"
)

func versionedJSONBody(t *testing.T, raw string, revision int64) *bytes.Reader {
	t.Helper()
	var value map[string]any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		t.Fatal(err)
	}
	value["expected_revision"] = revision
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return bytes.NewReader(body)
}

func mysqlRowRevision(t *testing.T, db *sql.DB, table string, id string) int64 {
	t.Helper()
	allowed := map[string]bool{"workspaces": true, "workspace_memberships": true, "accounts": true}
	if !allowed[table] {
		t.Fatalf("unsupported revision table %s", table)
	}
	var revision int64
	if err := db.QueryRowContext(context.Background(), fmt.Sprintf("SELECT row_version FROM %s WHERE id = ?", table), id).Scan(&revision); err != nil {
		t.Fatal(err)
	}
	return revision
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
				Operation:        "patch",
				WorkspaceID:      row.WorkspaceID,
				Entity:           row.Entity,
				ID:               row.ID,
				ExpectedRevision: existing.Revision,
				UpdatedAt:        row.UpdatedAt,
				Patch:            row.Payload,
			})
			continue
		}
		operations = append(operations, businessOperation{Operation: "create", Row: &row})
	}
	body, err := json.Marshal(teamDataSaveRequest{ProtocolVersion: 2, Operations: operations})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	api.handleTeamDataSave(recorder, httptest.NewRequest(http.MethodPut, "/team/data", bytes.NewReader(body)), auth)
	if recorder.Code != http.StatusOK {
		t.Fatalf("save status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response teamDataResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
}

func loadRows(t *testing.T, api *app, auth authContext, _ int64) teamDataResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	api.handleTeamDataLoad(recorder, httptest.NewRequest(http.MethodGet, "/team/data", nil), auth)
	if recorder.Code != http.StatusOK {
		t.Fatalf("load status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response teamDataResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
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
