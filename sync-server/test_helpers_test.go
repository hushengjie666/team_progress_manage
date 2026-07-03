package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"github.com/go-sql-driver/mysql"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"
)

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
	if err := saveStoreToMySQL(db, seededStore()); err != nil {
		t.Fatal(err)
	}
	return newApp(defaultConfig(), db)
}
func seededStore() store {
	return store{
		Version:      2,
		NextRevision: 1,
		Workspaces: map[string]workspaceData{
			"workspace_test": {
				ID:             "workspace_test",
				Name:           "测试团队",
				Type:           "shared",
				OwnerAccountID: "account_owner",
				Rows:           map[string]syncRow{},
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
func pushRows(t *testing.T, api *app, auth authContext, deviceID string, changes []syncRow) pushResponse {
	t.Helper()
	body, err := json.Marshal(pushRequest{DeviceID: deviceID, Changes: changes})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	api.handleTeamChanges(recorder, httptest.NewRequest(http.MethodPost, "/team/changes", bytes.NewReader(body)), auth)
	if recorder.Code != http.StatusOK {
		t.Fatalf("push status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response pushResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
}
func pullRows(t *testing.T, api *app, auth authContext, since int64) pullResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	api.handleTeamState(recorder, httptest.NewRequest(http.MethodGet, "/team/state", nil), auth)
	if recorder.Code != http.StatusOK {
		t.Fatalf("pull status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response pullResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if since > 0 {
		filtered := response.Changes[:0]
		for _, row := range response.Changes {
			if row.Revision > since {
				filtered = append(filtered, row)
			}
		}
		response.Changes = filtered
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
	baseDSN := strings.TrimSpace(os.Getenv("TM_SYNC_TEST_MYSQL_DSN"))
	if baseDSN == "" {
		t.Skip("set TM_SYNC_TEST_MYSQL_DSN to run MySQL integration tests")
	}
	cfg, err := mysql.ParseDSN(baseDSN)
	if err != nil {
		t.Fatalf("invalid TM_SYNC_TEST_MYSQL_DSN: %v", err)
	}
	if cfg.DBName == "" {
		t.Fatal("TM_SYNC_TEST_MYSQL_DSN must include a database name")
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
