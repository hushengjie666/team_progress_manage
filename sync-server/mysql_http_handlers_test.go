package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMySQLHTTPHandlersSmoke(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), db)
	mux := http.NewServeMux()
	mux.HandleFunc("/health", api.handleHealth)
	mux.HandleFunc("/auth/status", api.handleAuthStatus)
	mux.HandleFunc("/auth/bootstrap", api.handleBootstrap)
	mux.HandleFunc("/auth/login", api.handleLogin)
	mux.HandleFunc("/team/changes", api.withAuth(api.handleTeamChanges))
	mux.HandleFunc("/team/state", api.withAuth(api.handleTeamState))
	mux.HandleFunc("/team/revision", api.withAuth(api.handleTeamRevision))
	server := httptest.NewServer(withCORS(mux))
	defer server.Close()

	healthRecorder, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer healthRecorder.Body.Close()
	if healthRecorder.StatusCode != http.StatusOK {
		t.Fatalf("health status = %d", healthRecorder.StatusCode)
	}

	loginBody := bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_http"}`))
	loginHTTPResponse, err := http.Post(server.URL+"/auth/login", "application/json", loginBody)
	if err != nil {
		t.Fatal(err)
	}
	defer loginHTTPResponse.Body.Close()
	if loginHTTPResponse.StatusCode != http.StatusOK {
		t.Fatalf("login status = %d", loginHTTPResponse.StatusCode)
	}
	var login loginResponse
	if err := json.NewDecoder(loginHTTPResponse.Body).Decode(&login); err != nil {
		t.Fatal(err)
	}
	if login.Token == "" {
		t.Fatal("login did not return token")
	}

	pushBody, err := json.Marshal(pushRequest{
		DeviceID: "device_http",
		Changes: []syncRow{
			{
				Entity:    "project",
				ID:        "project_http",
				UpdatedAt: "2026-06-29T09:00:00Z",
				Payload:   json.RawMessage(`{"id":"project_http","name":"HTTP 项目","updatedAt":"2026-06-29T09:00:00Z"}`),
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	pushRequest, err := http.NewRequest(http.MethodPost, server.URL+"/team/changes", bytes.NewReader(pushBody))
	if err != nil {
		t.Fatal(err)
	}
	pushRequest.Header.Set("Content-Type", "application/json")
	pushRequest.Header.Set("Authorization", "Bearer "+login.Token)
	pushResponseHTTP, err := http.DefaultClient.Do(pushRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer pushResponseHTTP.Body.Close()
	if pushResponseHTTP.StatusCode != http.StatusOK {
		t.Fatalf("push status = %d", pushResponseHTTP.StatusCode)
	}
	var pushed pushResponse
	if err := json.NewDecoder(pushResponseHTTP.Body).Decode(&pushed); err != nil {
		t.Fatal(err)
	}
	if pushed.CurrentRevision != 1 {
		t.Fatalf("push response = %#v", pushed)
	}

	pullRequest, err := http.NewRequest(http.MethodGet, server.URL+"/team/state", nil)
	if err != nil {
		t.Fatal(err)
	}
	pullRequest.Header.Set("Authorization", "Bearer "+login.Token)
	pullResponseHTTP, err := http.DefaultClient.Do(pullRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer pullResponseHTTP.Body.Close()
	if pullResponseHTTP.StatusCode != http.StatusOK {
		t.Fatalf("pull status = %d", pullResponseHTTP.StatusCode)
	}
	var pulled pullResponse
	if err := json.NewDecoder(pullResponseHTTP.Body).Decode(&pulled); err != nil {
		t.Fatal(err)
	}
	if len(pulled.Changes) != 1 || pulled.Changes[0].ID != "project_http" || pulled.CurrentRevision != 1 {
		t.Fatalf("pull response = %#v", pulled)
	}

	revisionRequest, err := http.NewRequest(http.MethodGet, server.URL+"/team/revision", nil)
	if err != nil {
		t.Fatal(err)
	}
	revisionRequest.Header.Set("Authorization", "Bearer "+login.Token)
	revisionResponseHTTP, err := http.DefaultClient.Do(revisionRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer revisionResponseHTTP.Body.Close()
	var revision revisionResponse
	if err := json.NewDecoder(revisionResponseHTTP.Body).Decode(&revision); err != nil {
		t.Fatal(err)
	}
	if revision.CurrentRevision != 1 {
		t.Fatalf("revision = %d", revision.CurrentRevision)
	}
}
