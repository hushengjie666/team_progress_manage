package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMySQLAccountSettingsKeepConcurrentNamespacesAndAccountsSeparate(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), db)

	login := httptest.NewRecorder()
	api.handleLogin(login, httptest.NewRequest(http.MethodPost, "/auth/login", defaultAdminLoginBody(t, "device_admin")))
	var owner loginResponse
	if login.Code != http.StatusOK {
		t.Fatalf("admin login status %d: %s", login.Code, login.Body)
	}
	if err := json.Unmarshal(login.Body.Bytes(), &owner); err != nil {
		t.Fatal(err)
	}
	ownerAuth := authContext{AccountID: owner.Account.ID, WorkspaceID: owner.Workspace.ID}

	created := httptest.NewRecorder()
	api.handleAdminAccounts(created, httptest.NewRequest(http.MethodPost, "/admin/accounts",
		strings.NewReader(`{"name":"Quote Test","email":"quotes@example.test","password":"test-password","status":"active"}`)), ownerAuth)
	var other platformAccountResponse
	if created.Code != http.StatusOK {
		t.Fatalf("test account creation status %d: %s", created.Code, created.Body)
	}
	if err := json.Unmarshal(created.Body.Bytes(), &other); err != nil {
		t.Fatal(err)
	}

	patches := []string{`{"dailyQuotes":{"time":"08:00","timeZone":"Asia/Shanghai"}}`, `{"focusMinutes":40}`}
	keys := []string{"dailyQuotes", "focusMinutes"}
	begun := make(chan struct{})
	responses := make([]chan *httptest.ResponseRecorder, len(patches))
	for index, patch := range patches {
		responses[index] = make(chan *httptest.ResponseRecorder, 1)
		go func(body string, result chan<- *httptest.ResponseRecorder) {
			<-begun
			response := httptest.NewRecorder()
			api.handleAccountSettings(response, httptest.NewRequest(http.MethodPatch, "/settings", strings.NewReader(body)), ownerAuth)
			result <- response
		}(patch, responses[index])
	}
	close(begun)
	for index, result := range responses {
		response := <-result
		var delta mutationDeltaResponse
		if response.Code != http.StatusOK {
			t.Fatalf("patch %s status %d: %s", keys[index], response.Code, response.Body)
		}
		if err := json.Unmarshal(response.Body.Bytes(), &delta); err != nil {
			t.Fatal(err)
		}
		if len(delta.Settings) != 1 || delta.Settings[keys[index]] == nil {
			t.Fatalf("patch response settings = %v, want only %s", delta.Settings, keys[index])
		}
	}

	get := func(auth authContext) map[string]json.RawMessage {
		t.Helper()
		response := httptest.NewRecorder()
		api.handleAccountSettings(response, httptest.NewRequest(http.MethodGet, "/settings", nil), auth)
		if response.Code != http.StatusOK {
			t.Fatalf("get settings status %d: %s", response.Code, response.Body)
		}
		var payload struct {
			Settings map[string]json.RawMessage `json:"settings"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		return payload.Settings
	}
	saved := get(ownerAuth)
	if !bytes.Equal(saved["focusMinutes"], []byte("40")) || !bytes.Contains(saved["dailyQuotes"], []byte("Asia/Shanghai")) {
		t.Fatalf("expected both namespaces to persist, got %v", saved)
	}
	if otherSettings := get(authContext{AccountID: other.Account.ID, WorkspaceID: ownerAuth.WorkspaceID}); len(otherSettings) != 0 {
		t.Fatalf("other account received settings: %v", otherSettings)
	}
}
