package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBootstrapAndLoginCreateWorkspaceAccount(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), db)

	body := bytes.NewReader([]byte(`{"workspace_name":"交付团队","name":"负责人","email":"owner@example.com","password":"secret","device_id":"device_a"}`))
	recorder := httptest.NewRecorder()
	api.handleBootstrap(recorder, httptest.NewRequest(http.MethodPost, "/auth/bootstrap", body))
	if recorder.Code != http.StatusOK {
		t.Fatalf("bootstrap status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var bootstrap loginResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &bootstrap); err != nil {
		t.Fatal(err)
	}
	if bootstrap.Token == "" || bootstrap.Account.Email != "owner@example.com" || bootstrap.Workspace.Name != "交付团队" {
		t.Fatalf("unexpected bootstrap response: %#v", bootstrap)
	}
	stored, found, err := mysqlAccountByID(context.Background(), db, bootstrap.Account.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !found {
		t.Fatal("bootstrap account was not stored")
	}
	if stored.PasswordHash == "secret" || stored.PasswordHash == "" || bootstrap.Account.PasswordHash != "" {
		t.Fatalf("password hash exposure/storage failed: response=%#v stored=%#v", bootstrap.Account, stored)
	}

	loginBody := bytes.NewReader([]byte(`{"email":"owner@example.com","password":"secret","device_id":"device_b"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}
