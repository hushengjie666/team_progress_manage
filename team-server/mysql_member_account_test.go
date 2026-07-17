package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func seedProjectOwnerRows(t *testing.T, api *app) teamDataResponse {
	t.Helper()
	return saveRows(t, api, ownerAuth(), "device_a", []businessRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"后台项目","defaultExpectedStartHours":6,"updatedAt":"2026-05-10T08:01:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_sync",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"负责人","roles":["project_owner","executor"],"status":"active","updatedAt":"2026-05-10T08:03:00Z"}`),
		},
	})
}

func TestProjectOwnerCreatesMemberAccount(t *testing.T) {
	api := mysqlSeededApp(t)
	seedProjectOwnerRows(t, api)
	body := bytes.NewReader([]byte(`{"project_id":"project_sync","name":"执行者","email":"executor@example.com","password":"demo","roles":["executor"],"status":"active"}`))
	recorder := httptest.NewRecorder()
	api.handleMembers(recorder, httptest.NewRequest(http.MethodPost, "/members", body), ownerAuth())
	if recorder.Code != http.StatusOK {
		t.Fatalf("create member status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response memberResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Account.Email != "executor@example.com" || response.Member.Entity != "project_member" {
		t.Fatalf("unexpected member response: %#v", response)
	}
	if _, found, err := businessExistingRow(t.Context(), api.db, "workspace_test", "project_member", response.Member.ID); err != nil || !found {
		t.Fatalf("created project member was not persisted: id=%q workspace=%q found=%v err=%v", response.Member.ID, response.Member.WorkspaceID, found, err)
	}
	patchBody := versionedJSONBody(t, `{"password":"new-demo"}`, 0)
	patchRecorder := httptest.NewRecorder()
	api.handleMemberByID(patchRecorder, httptest.NewRequest(http.MethodPatch, "/members/"+response.Member.ID, patchBody), ownerAuth())
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("patch member status = %d, body = %s", patchRecorder.Code, patchRecorder.Body.String())
	}
	loginBody := bytes.NewReader([]byte(`{"email":"executor@example.com","password":"new-demo","device_id":"device_executor"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with patched password status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	pulled := loadRows(t, api, ownerAuth(), 0)
	if len(pulled.Rows) != 3 {
		t.Fatalf("expected three workspace rows, got %d", len(pulled.Rows))
	}
}

func TestProjectOwnerCreatesWorkspaceMemberAccount(t *testing.T) {
	api := mysqlSeededApp(t)
	seedProjectOwnerRows(t, api)
	body := []byte(`{"name":"成员库成员","email":"directory@example.com","password":"demo","status":"active"}`)
	recorder := httptest.NewRecorder()
	api.handleMembers(recorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(body)), ownerAuth())
	if recorder.Code != http.StatusOK {
		t.Fatalf("create workspace member status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response memberResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Account.Email != "directory@example.com" || response.Member.Entity != "" {
		t.Fatalf("unexpected workspace member response: %#v", response)
	}
	duplicateBody := []byte(`{"name":"重复成员","email":"directory@example.com","password":"new-demo","status":"active"}`)
	duplicateRecorder := httptest.NewRecorder()
	api.handleMembers(duplicateRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(duplicateBody)), ownerAuth())
	if duplicateRecorder.Code != http.StatusOK {
		t.Fatalf("duplicate workspace member status = %d, body = %s", duplicateRecorder.Code, duplicateRecorder.Body.String())
	}
	var duplicateResponse memberResponse
	if err := json.Unmarshal(duplicateRecorder.Body.Bytes(), &duplicateResponse); err != nil {
		t.Fatal(err)
	}
	if duplicateResponse.Account.ID != response.Account.ID || duplicateResponse.Member.Entity != "" {
		t.Fatalf("duplicate workspace member should update account only: %#v", duplicateResponse)
	}
	loginBody := bytes.NewReader([]byte(`{"email":"directory@example.com","password":"new-demo","device_id":"device_directory"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with patched workspace member password status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}
