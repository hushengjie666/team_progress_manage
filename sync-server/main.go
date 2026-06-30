package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type store struct {
	Version      int                      `json:"version"`
	NextRevision int64                    `json:"next_revision"`
	Workspaces   map[string]workspaceData `json:"workspaces"`
	Accounts     map[string]accountRecord `json:"accounts"`
	Users        map[string]userData      `json:"users,omitempty"`
}

type userData struct {
	Rows map[string]syncRow `json:"rows"`
}

type workspaceData struct {
	ID        string             `json:"id"`
	Name      string             `json:"name"`
	Rows      map[string]syncRow `json:"rows"`
	CreatedAt string             `json:"created_at"`
	UpdatedAt string             `json:"updated_at"`
}

type accountRecord struct {
	ID           string `json:"id"`
	WorkspaceID  string `json:"workspace_id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	PasswordHash string `json:"password_hash"`
	DisabledAt   string `json:"disabled_at,omitempty"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type syncRow struct {
	UserID      string          `json:"user_id,omitempty"`
	WorkspaceID string          `json:"workspace_id,omitempty"`
	AccountID   string          `json:"account_id,omitempty"`
	Entity      string          `json:"entity"`
	ID          string          `json:"id"`
	DeviceID    string          `json:"device_id"`
	UpdatedAt   string          `json:"updated_at"`
	DeletedAt   string          `json:"deleted_at,omitempty"`
	Version     int             `json:"version"`
	Revision    int64           `json:"revision"`
	Payload     json.RawMessage `json:"payload"`
}

type loginRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	DeviceID string `json:"device_id"`
}

type bootstrapRequest struct {
	WorkspaceName string `json:"workspace_name"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	DeviceID      string `json:"device_id"`
}

type loginResponse struct {
	Token     string           `json:"token"`
	UserID    string           `json:"user_id"`
	ExpiresAt string           `json:"expires_at"`
	Account   accountRecord    `json:"account"`
	Workspace workspaceSummary `json:"workspace"`
}

type authStatusResponse struct {
	Bootstrapped  bool   `json:"bootstrapped"`
	WorkspaceID   string `json:"workspace_id,omitempty"`
	WorkspaceName string `json:"workspace_name,omitempty"`
}

type workspaceSummary struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type memberRequest struct {
	ProjectID string   `json:"project_id"`
	Name      string   `json:"name"`
	Email     string   `json:"email"`
	Password  string   `json:"password"`
	Roles     []string `json:"roles"`
	Status    string   `json:"status,omitempty"`
}

type memberResponse struct {
	Account accountRecord `json:"account"`
	Member  syncRow       `json:"member"`
}

type changePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type pushRequest struct {
	DeviceID string    `json:"device_id"`
	Changes  []syncRow `json:"changes"`
}

type pushResponse struct {
	Accepted        []syncRow `json:"accepted"`
	Conflicts       []syncRow `json:"conflicts"`
	CurrentRevision int64     `json:"current_revision"`
}

type pullResponse struct {
	Changes         []syncRow `json:"changes"`
	CurrentRevision int64     `json:"current_revision"`
}

type revisionResponse struct {
	CurrentRevision int64 `json:"current_revision"`
}

type syncEvent struct {
	WorkspaceID     string `json:"workspace_id"`
	CurrentRevision int64  `json:"current_revision"`
	DeviceID        string `json:"device_id,omitempty"`
	Time            string `json:"time"`
}

type tokenClaims struct {
	UserID      string `json:"user_id,omitempty"`
	AccountID   string `json:"account_id"`
	WorkspaceID string `json:"workspace_id"`
	Exp         int64  `json:"exp"`
}

type authContext struct {
	AccountID   string
	WorkspaceID string
}

type app struct {
	mu              sync.Mutex
	eventsMu        sync.Mutex
	cfg             config
	store           store
	db              *sql.DB
	syncSubscribers map[string]map[chan syncEvent]struct{}
}

func main() {
	command, cfg, configPath, err := parseCLI(os.Args[1:])
	if err != nil {
		log.Fatal(err)
	}

	switch command {
	case "serve":
		if err := runHTTPServer(context.Background(), cfg); err != nil {
			log.Fatal(err)
		}
	case "migrate-file":
		if err := runMigrateFile(context.Background(), cfg); err != nil {
			log.Fatal(err)
		}
	case "service":
		if err := runWindowsService(cfg); err != nil {
			log.Fatal(err)
		}
	case "install":
		if err := installWindowsService(configPath); err != nil {
			log.Fatal(err)
		}
	case "uninstall":
		if err := uninstallWindowsService(); err != nil {
			log.Fatal(err)
		}
	case "start":
		if err := startWindowsService(); err != nil {
			log.Fatal(err)
		}
	case "stop":
		if err := stopWindowsService(); err != nil {
			log.Fatal(err)
		}
	default:
		log.Fatalf("unknown command %q; use serve, migrate-file, service, install, uninstall, start or stop", command)
	}
}

func runHTTPServer(ctx context.Context, cfg config) error {
	db, s, err := openMySQLStore(cfg.mysqlDSN)
	if err != nil {
		return fmt.Errorf("load mysql store: %w", err)
	}
	defer db.Close()
	api := newApp(cfg, s, db)
	mux := http.NewServeMux()
	mux.HandleFunc("/health", api.handleHealth)
	mux.HandleFunc("/auth/status", api.handleAuthStatus)
	mux.HandleFunc("/auth/bootstrap", api.handleBootstrap)
	mux.HandleFunc("/auth/login", api.handleLogin)
	mux.HandleFunc("/auth/me", api.withAuth(api.handleMe))
	mux.HandleFunc("/auth/change-password", api.withAuth(api.handleChangePassword))
	mux.HandleFunc("/members", api.withAuth(api.handleMembers))
	mux.HandleFunc("/members/", api.withAuth(api.handleMemberByID))
	mux.HandleFunc("/sync/status", api.withAuth(api.handleStatus))
	mux.HandleFunc("/sync/revision", api.withAuth(api.handleRevision))
	mux.HandleFunc("/sync/pull", api.withAuth(api.handlePull))
	mux.HandleFunc("/sync/push", api.withAuth(api.handlePush))
	mux.HandleFunc("/sync/events", api.handleEvents)
	mux.HandleFunc("/team/state", api.withAuth(api.handleTeamState))
	mux.HandleFunc("/team/revision", api.withAuth(api.handleTeamRevision))
	mux.HandleFunc("/team/changes", api.withAuth(api.handleTeamChanges))

	log.Printf("TimeManage sync server listening on http://%s", cfg.addr)
	log.Printf("Storage: MySQL")
	server := &http.Server{Addr: cfg.addr, Handler: withCORS(mux), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func runMigrateFile(ctx context.Context, cfg config) error {
	if strings.TrimSpace(cfg.migrateSource) == "" {
		return errors.New("migrate-file requires --source")
	}
	bytes, err := os.ReadFile(cfg.migrateSource)
	if err != nil {
		return fmt.Errorf("read legacy store: %w", err)
	}
	var legacy store
	if err := json.Unmarshal(bytes, &legacy); err != nil {
		return fmt.Errorf("parse legacy store: %w", err)
	}
	normalizeLegacyStore(&legacy)

	db, _, err := openMySQLStore(cfg.mysqlDSN)
	if err != nil {
		return fmt.Errorf("open mysql store: %w", err)
	}
	defer db.Close()

	if !cfg.replace {
		current, err := loadStoreFromMySQL(ctx, db)
		if err != nil {
			return fmt.Errorf("inspect mysql store: %w", err)
		}
		if !storeIsEmpty(current) {
			return errors.New("mysql store is not empty; rerun with --replace to overwrite it")
		}
	}
	if err := saveStoreToMySQL(db, legacy); err != nil {
		return fmt.Errorf("write mysql store: %w", err)
	}

	workspaces := len(legacy.Workspaces)
	accounts := len(legacy.Accounts)
	rows := 0
	for _, workspace := range legacy.Workspaces {
		rows += len(workspace.Rows)
	}
	log.Printf("Migrated legacy store %s to MySQL: workspaces=%d accounts=%d rows=%d next_revision=%d", cfg.migrateSource, workspaces, accounts, rows, legacy.NextRevision)
	return nil
}

func newApp(cfg config, s store, db ...*sql.DB) *app {
	var activeStore *sql.DB
	if len(db) > 0 {
		activeStore = db[0]
	}
	return &app{cfg: cfg, store: s, db: activeStore, syncSubscribers: map[string]map[chan syncEvent]struct{}{}}
}

func (a *app) saveLocked() error {
	if a.db != nil {
		return errors.New("saveLocked is disabled for mysql incremental storage")
	}
	return nil
}

func migrateLegacyUsers(s *store) {
	now := time.Now().UTC().Format(time.RFC3339)
	for username, user := range s.Users {
		workspaceID := "workspace_" + sanitizeID(username)
		if workspaceID == "workspace_" {
			workspaceID = "workspace_legacy"
		}
		rows := map[string]syncRow{}
		for rowKey, row := range user.Rows {
			row.WorkspaceID = workspaceID
			if row.AccountID == "" {
				row.AccountID = username
			}
			rows[rowKey] = row
		}
		s.Workspaces[workspaceID] = workspaceData{
			ID:        workspaceID,
			Name:      username,
			Rows:      rows,
			CreatedAt: now,
			UpdatedAt: now,
		}
	}
}

func normalizeLegacyStore(s *store) {
	if s.Version == 0 {
		s.Version = 2
	}
	if s.NextRevision < 1 {
		s.NextRevision = 1
	}
	if s.Workspaces == nil {
		s.Workspaces = map[string]workspaceData{}
	}
	if s.Accounts == nil {
		s.Accounts = map[string]accountRecord{}
	}
	if s.Users == nil {
		s.Users = map[string]userData{}
	}
	migrateLegacyUsers(s)
	for workspaceID, workspace := range s.Workspaces {
		if workspace.ID == "" {
			workspace.ID = workspaceID
		}
		if workspace.Name == "" {
			workspace.Name = "默认团队"
		}
		if workspace.CreatedAt == "" {
			workspace.CreatedAt = time.Now().UTC().Format(time.RFC3339)
		}
		if workspace.UpdatedAt == "" {
			workspace.UpdatedAt = workspace.CreatedAt
		}
		if workspace.Rows == nil {
			workspace.Rows = map[string]syncRow{}
		}
		for rowKey, row := range workspace.Rows {
			if row.WorkspaceID == "" {
				row.WorkspaceID = workspace.ID
			}
			workspace.Rows[rowKey] = row
		}
		s.Workspaces[workspaceID] = workspace
	}
}

func storeIsEmpty(s store) bool {
	if len(s.Accounts) > 0 || len(s.Workspaces) > 0 {
		return false
	}
	for _, workspace := range s.Workspaces {
		if len(workspace.Rows) > 0 {
			return false
		}
	}
	return true
}

func key(entity, id string) string {
	return entity + "/" + id
}

func (a *app) workspaceLocked(workspaceID string) workspaceData {
	current := a.store.Workspaces[workspaceID]
	if current.ID == "" {
		current.ID = workspaceID
		current.Name = "默认团队"
		current.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if current.Rows == nil {
		current.Rows = map[string]syncRow{}
	}
	if current.UpdatedAt == "" {
		current.UpdatedAt = current.CreatedAt
	}
	a.store.Workspaces[workspaceID] = current
	return current
}

func firstWorkspace(s store) workspaceData {
	for _, workspace := range s.Workspaces {
		return workspace
	}
	return workspaceData{}
}

func sanitizeID(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
		} else if r == '-' || r == '_' {
			builder.WriteRune('_')
		}
	}
	return builder.String()
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *app) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

func (a *app) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	if a.db != nil {
		a.handleAuthStatusMySQL(w, r)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	workspace := firstWorkspace(a.store)
	writeJSON(w, http.StatusOK, authStatusResponse{
		Bootstrapped:  len(a.store.Accounts) > 0,
		WorkspaceID:   workspace.ID,
		WorkspaceName: workspace.Name,
	})
}

func (a *app) handleBootstrap(w http.ResponseWriter, r *http.Request) {
	if a.db != nil {
		a.handleBootstrapMySQL(w, r)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req bootstrapRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	email := normalizeEmail(req.Email)
	if email == "" || strings.TrimSpace(req.Password) == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	if len(a.store.Accounts) > 0 {
		writeError(w, http.StatusConflict, "workspace already bootstrapped")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	workspaceID := newID("workspace")
	accountID := newID("account")
	hash, err := hashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}
	workspace := workspaceData{
		ID:        workspaceID,
		Name:      fallback(strings.TrimSpace(req.WorkspaceName), "默认团队"),
		Rows:      map[string]syncRow{},
		CreatedAt: now,
		UpdatedAt: now,
	}
	account := accountRecord{
		ID:           accountID,
		WorkspaceID:  workspaceID,
		Name:         fallback(strings.TrimSpace(req.Name), "项目负责人"),
		Email:        email,
		PasswordHash: hash,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	a.store.Workspaces[workspaceID] = workspace
	a.store.Accounts[accountID] = account
	if err := a.saveLocked(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}

	a.writeLoginResponse(w, req.DeviceID, account, workspace)
}

func (a *app) handleLogin(w http.ResponseWriter, r *http.Request) {
	if a.db != nil {
		a.handleLoginMySQL(w, r)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req loginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	email := normalizeEmail(firstNonEmpty(req.Email, req.Username))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	account, found := a.accountByEmailLocked(email)
	if !found || account.DisabledAt != "" || !checkPassword(req.Password, account.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	workspace := a.workspaceLocked(account.WorkspaceID)
	a.writeLoginResponse(w, req.DeviceID, account, workspace)
}

func (a *app) handleMe(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db != nil {
		a.handleMeMySQL(w, r, auth)
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	account, ok := a.store.Accounts[auth.AccountID]
	if !ok {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"account":   account,
		"workspace": publicWorkspace(a.workspaceLocked(auth.WorkspaceID)),
	})
}

func (a *app) handleChangePassword(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db != nil {
		a.handleChangePasswordMySQL(w, r, auth)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req changePasswordRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.NewPassword) == "" {
		writeError(w, http.StatusBadRequest, "new_password is required")
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	account, ok := a.store.Accounts[auth.AccountID]
	if !ok || !checkPassword(req.OldPassword, account.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "invalid password")
		return
	}
	hash, err := hashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}
	account.PasswordHash = hash
	account.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	a.store.Accounts[account.ID] = account
	if err := a.saveLocked(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *app) handleStatus(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db != nil {
		a.handleStatusMySQL(w, r, auth)
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	workspace := a.workspaceLocked(auth.WorkspaceID)
	writeJSON(w, http.StatusOK, map[string]any{
		"user_id":          auth.AccountID,
		"account_id":       auth.AccountID,
		"workspace_id":     auth.WorkspaceID,
		"rows":             len(workspace.Rows),
		"current_revision": a.store.NextRevision - 1,
	})
}

func (a *app) handlePull(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db != nil {
		a.handlePullMySQL(w, r, auth)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	since := int64(0)
	if raw := strings.TrimSpace(r.URL.Query().Get("since")); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "since must be a number")
			return
		}
		since = value
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	workspace := a.workspaceLocked(auth.WorkspaceID)
	rows := make([]syncRow, 0)
	for _, row := range workspace.Rows {
		if row.Revision > since {
			rows = append(rows, row)
		}
	}
	sort.Slice(rows, func(i, j int) bool {
		return rows[i].Revision < rows[j].Revision
	})
	writeJSON(w, http.StatusOK, pullResponse{
		Changes:         rows,
		CurrentRevision: a.store.NextRevision - 1,
	})
}

func (a *app) handleRevision(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db != nil {
		a.handleRevisionMySQL(w, r, auth)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	a.mu.Lock()
	currentRevision := a.store.NextRevision - 1
	a.mu.Unlock()
	writeJSON(w, http.StatusOK, revisionResponse{CurrentRevision: currentRevision})
}

func (a *app) handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	auth, err := a.verifyEventRequest(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming is not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	deviceID := strings.TrimSpace(r.URL.Query().Get("device_id"))
	events, unsubscribe := a.subscribeWorkspace(auth.WorkspaceID)
	defer unsubscribe()

	currentRevision := a.eventCurrentRevision(r.Context())
	writeSSE(w, "hello", syncEvent{
		WorkspaceID:     auth.WorkspaceID,
		CurrentRevision: currentRevision,
		DeviceID:        deviceID,
		Time:            time.Now().UTC().Format(time.RFC3339),
	})
	flusher.Flush()

	keepAlive := time.NewTicker(25 * time.Second)
	defer keepAlive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case event := <-events:
			writeSSE(w, "revision", event)
			flusher.Flush()
		case <-keepAlive.C:
			_, _ = w.Write([]byte(": keepalive\n\n"))
			flusher.Flush()
		}
	}
}

func writeSSE(w http.ResponseWriter, eventName string, payload syncEvent) {
	bytes, err := json.Marshal(payload)
	if err != nil {
		return
	}
	_, _ = fmt.Fprintf(w, "event: %s\n", eventName)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", bytes)
}

func (a *app) subscribeWorkspace(workspaceID string) (<-chan syncEvent, func()) {
	ch := make(chan syncEvent, 16)
	a.eventsMu.Lock()
	if a.syncSubscribers == nil {
		a.syncSubscribers = map[string]map[chan syncEvent]struct{}{}
	}
	if a.syncSubscribers[workspaceID] == nil {
		a.syncSubscribers[workspaceID] = map[chan syncEvent]struct{}{}
	}
	a.syncSubscribers[workspaceID][ch] = struct{}{}
	a.eventsMu.Unlock()

	unsubscribe := func() {
		a.eventsMu.Lock()
		defer a.eventsMu.Unlock()
		delete(a.syncSubscribers[workspaceID], ch)
		if len(a.syncSubscribers[workspaceID]) == 0 {
			delete(a.syncSubscribers, workspaceID)
		}
		close(ch)
	}
	return ch, unsubscribe
}

func (a *app) notifyWorkspaceChanged(workspaceID string, revision int64, deviceID string) {
	if workspaceID == "" || revision <= 0 {
		return
	}
	event := syncEvent{
		WorkspaceID:     workspaceID,
		CurrentRevision: revision,
		DeviceID:        deviceID,
		Time:            time.Now().UTC().Format(time.RFC3339),
	}
	a.eventsMu.Lock()
	defer a.eventsMu.Unlock()
	for ch := range a.syncSubscribers[workspaceID] {
		select {
		case ch <- event:
		default:
		}
	}
}

func (a *app) handlePush(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db != nil {
		a.handlePushMySQL(w, r, auth)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req pushRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	if len(req.Changes) > 2000 {
		writeError(w, http.StatusBadRequest, "too many changes")
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	workspace := a.workspaceLocked(auth.WorkspaceID)
	accepted := make([]syncRow, 0, len(req.Changes))
	conflicts := make([]syncRow, 0)
	changedRows := 0

	for _, change := range req.Changes {
		change.UserID = auth.AccountID
		change.AccountID = auth.AccountID
		change.WorkspaceID = auth.WorkspaceID
		change.DeviceID = req.DeviceID
		change.Entity = strings.TrimSpace(change.Entity)
		change.ID = strings.TrimSpace(change.ID)
		if change.Entity == "" || change.ID == "" {
			conflicts = append(conflicts, change)
			continue
		}
		if _, err := time.Parse(time.RFC3339, change.UpdatedAt); err != nil {
			if _, err := time.Parse(time.RFC3339Nano, change.UpdatedAt); err != nil {
				conflicts = append(conflicts, change)
				continue
			}
		}
		if len(change.Payload) == 0 {
			change.Payload = json.RawMessage(`{}`)
		}
		if change.Version == 0 {
			change.Version = 1
		}
		if err := a.authorizeChangeLocked(auth, workspace, change); err != nil {
			conflicts = append(conflicts, change)
			continue
		}

		rowKey := key(change.Entity, change.ID)
		existing, found := workspace.Rows[rowKey]
		if found && change.UpdatedAt < existing.UpdatedAt {
			conflicts = append(conflicts, existing)
			continue
		}
		if found && change.UpdatedAt == existing.UpdatedAt && string(change.Payload) == string(existing.Payload) && change.DeletedAt == existing.DeletedAt {
			accepted = append(accepted, existing)
			continue
		}

		change.Revision = a.store.NextRevision
		a.store.NextRevision++
		workspace.Rows[rowKey] = change
		accepted = append(accepted, change)
		changedRows++
	}
	workspace.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	a.store.Workspaces[auth.WorkspaceID] = workspace

	if changedRows > 0 {
		if err := a.saveLocked(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		a.notifyWorkspaceChanged(auth.WorkspaceID, a.store.NextRevision-1, req.DeviceID)
	}

	writeJSON(w, http.StatusOK, pushResponse{
		Accepted:        accepted,
		Conflicts:       conflicts,
		CurrentRevision: a.store.NextRevision - 1,
	})
}

func (a *app) handleMembers(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db != nil {
		a.handleMembersMySQL(w, r, auth)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req memberRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	projectID := strings.TrimSpace(req.ProjectID)
	email := normalizeEmail(req.Email)
	if email == "" || strings.TrimSpace(req.Password) == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	workspace := a.workspaceLocked(auth.WorkspaceID)
	account, found := a.accountByEmailLocked(email)
	if found && account.WorkspaceID != auth.WorkspaceID {
		writeError(w, http.StatusConflict, "email belongs to another workspace")
		return
	}
	if found && projectID == "" {
		writeError(w, http.StatusConflict, "email already exists")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if !found {
		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "password hashing failed")
			return
		}
		account = accountRecord{
			ID:           newID("account"),
			WorkspaceID:  auth.WorkspaceID,
			Name:         fallback(strings.TrimSpace(req.Name), email),
			Email:        email,
			PasswordHash: hash,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		a.store.Accounts[account.ID] = account
	}
	teamMemberID := "team_member_" + account.ID
	if projectID == "" {
		if _, exists := workspace.Rows[key("team_member", teamMemberID)]; exists {
			writeError(w, http.StatusConflict, "member account already exists")
			return
		}
		teamMemberPayload := map[string]any{
			"id":        teamMemberID,
			"accountId": account.ID,
			"name":      fallback(strings.TrimSpace(req.Name), account.Name),
			"email":     account.Email,
			"status":    fallback(strings.TrimSpace(req.Status), "active"),
			"createdAt": now,
			"updatedAt": now,
		}
		payload, _ := json.Marshal(teamMemberPayload)
		row := syncRow{
			UserID:      auth.AccountID,
			AccountID:   auth.AccountID,
			WorkspaceID: auth.WorkspaceID,
			Entity:      "team_member",
			ID:          teamMemberID,
			DeviceID:    "server",
			UpdatedAt:   now,
			Version:     1,
			Revision:    a.store.NextRevision,
			Payload:     payload,
		}
		a.store.NextRevision++
		workspace.Rows[key(row.Entity, row.ID)] = row
		workspace.UpdatedAt = now
		a.store.Workspaces[auth.WorkspaceID] = workspace
		if err := a.saveLocked(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		a.notifyWorkspaceChanged(auth.WorkspaceID, a.store.NextRevision-1, "server")
		writeJSON(w, http.StatusOK, memberResponse{Account: account, Member: row})
		return
	}
	if _, exists := workspace.Rows[key("team_member", teamMemberID)]; !exists {
		teamMemberPayload := map[string]any{
			"id":        teamMemberID,
			"accountId": account.ID,
			"name":      fallback(strings.TrimSpace(req.Name), account.Name),
			"email":     account.Email,
			"status":    fallback(strings.TrimSpace(req.Status), "active"),
			"createdAt": now,
			"updatedAt": now,
		}
		payload, _ := json.Marshal(teamMemberPayload)
		workspace.Rows[key("team_member", teamMemberID)] = syncRow{
			UserID:      auth.AccountID,
			AccountID:   auth.AccountID,
			WorkspaceID: auth.WorkspaceID,
			Entity:      "team_member",
			ID:          teamMemberID,
			DeviceID:    "server",
			UpdatedAt:   now,
			Version:     1,
			Revision:    a.store.NextRevision,
			Payload:     payload,
		}
		a.store.NextRevision++
	}
	memberID := "member_" + projectID + "_" + account.ID
	if _, exists := workspace.Rows[key("project_member", memberID)]; exists {
		writeError(w, http.StatusConflict, "account already belongs to this project")
		return
	}
	memberPayload := map[string]any{
		"id":           memberID,
		"projectId":    projectID,
		"teamMemberId": teamMemberID,
		"accountId":    account.ID,
		"name":         fallback(strings.TrimSpace(req.Name), account.Name),
		"email":        account.Email,
		"roles":        normalizeRoles(req.Roles),
		"status":       fallback(strings.TrimSpace(req.Status), "active"),
		"createdAt":    now,
		"updatedAt":    now,
	}
	payload, _ := json.Marshal(memberPayload)
	row := syncRow{
		UserID:      auth.AccountID,
		AccountID:   auth.AccountID,
		WorkspaceID: auth.WorkspaceID,
		Entity:      "project_member",
		ID:          memberID,
		DeviceID:    "server",
		UpdatedAt:   now,
		Version:     1,
		Revision:    a.store.NextRevision,
		Payload:     payload,
	}
	a.store.NextRevision++
	workspace.Rows[key(row.Entity, row.ID)] = row
	workspace.UpdatedAt = now
	a.store.Workspaces[auth.WorkspaceID] = workspace
	if err := a.saveLocked(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.notifyWorkspaceChanged(auth.WorkspaceID, a.store.NextRevision-1, "server")
	writeJSON(w, http.StatusOK, memberResponse{Account: account, Member: row})
}

func (a *app) handleMemberByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db != nil {
		a.handleMemberByIDMySQL(w, r, auth)
		return
	}
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	memberID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/members/"), "/")
	if memberID == "" {
		writeError(w, http.StatusBadRequest, "member id is required")
		return
	}
	var req memberRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	workspace := a.workspaceLocked(auth.WorkspaceID)
	existing, found := workspace.Rows[key("project_member", memberID)]
	if !found {
		existing, found = workspace.Rows[key("team_member", memberID)]
	}
	if !found && strings.HasPrefix(memberID, "team_member_") {
		accountID := strings.TrimPrefix(memberID, "team_member_")
		account, ok := a.store.Accounts[accountID]
		if ok && account.WorkspaceID == auth.WorkspaceID {
			timestamp := time.Now().UTC().Format(time.RFC3339)
			status := "active"
			if account.DisabledAt != "" {
				status = "disabled"
			}
			payload, _ := json.Marshal(map[string]any{
				"id":        memberID,
				"accountId": account.ID,
				"name":      account.Name,
				"email":     account.Email,
				"status":    status,
				"createdAt": fallback(account.CreatedAt, timestamp),
				"updatedAt": fallback(account.UpdatedAt, timestamp),
			})
			existing = syncRow{
				UserID:      auth.AccountID,
				AccountID:   auth.AccountID,
				WorkspaceID: auth.WorkspaceID,
				Entity:      "team_member",
				ID:          memberID,
				DeviceID:    "server",
				UpdatedAt:   timestamp,
				Version:     1,
				Payload:     payload,
			}
			found = true
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	var payload map[string]any
	if err := json.Unmarshal(existing.Payload, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid member payload")
		return
	}
	projectID, _ := payload["projectId"].(string)
	_ = projectID
	now := time.Now().UTC().Format(time.RFC3339)
	if strings.TrimSpace(req.Name) != "" {
		payload["name"] = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.Email) != "" {
		email := normalizeEmail(req.Email)
		if existing.Entity == "team_member" {
			accountID, _ := payload["accountId"].(string)
			if accountID != "" {
				for _, account := range a.store.Accounts {
					if normalizeEmail(account.Email) == email && account.ID != accountID {
						writeError(w, http.StatusConflict, "email belongs to another account")
						return
					}
				}
			}
		}
		payload["email"] = email
	}
	if len(req.Roles) > 0 {
		payload["roles"] = normalizeRoles(req.Roles)
	}
	if strings.TrimSpace(req.Status) != "" {
		payload["status"] = strings.TrimSpace(req.Status)
	}
	if strings.TrimSpace(req.Password) != "" {
		accountID, _ := payload["accountId"].(string)
		email, _ := payload["email"].(string)
		if accountID == "" && existing.Entity == "team_member" {
			accountID = newID("account")
			payload["accountId"] = accountID
		}
		if accountID == "" {
			writeError(w, http.StatusBadRequest, "member account is required to update password")
			return
		}
		account, ok := a.store.Accounts[accountID]
		if !ok || account.WorkspaceID != auth.WorkspaceID {
			if existing.Entity != "team_member" || normalizeEmail(email) == "" {
				writeError(w, http.StatusNotFound, "member account not found")
				return
			}
			for _, item := range a.store.Accounts {
				if item.ID != accountID && item.WorkspaceID == auth.WorkspaceID && normalizeEmail(item.Email) == normalizeEmail(email) {
					writeError(w, http.StatusConflict, "email belongs to another account")
					return
				}
			}
			name, _ := payload["name"].(string)
			account = accountRecord{
				ID:          accountID,
				WorkspaceID: auth.WorkspaceID,
				Name:        fallback(strings.TrimSpace(name), normalizeEmail(email)),
				Email:       normalizeEmail(email),
				CreatedAt:   now,
				UpdatedAt:   now,
			}
		}
		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "password hashing failed")
			return
		}
		account.PasswordHash = hash
		if name, ok := payload["name"].(string); ok && strings.TrimSpace(name) != "" {
			account.Name = strings.TrimSpace(name)
		}
		if email, ok := payload["email"].(string); ok && strings.TrimSpace(email) != "" {
			account.Email = normalizeEmail(email)
		}
		account.UpdatedAt = now
		a.store.Accounts[account.ID] = account
	}
	if existing.Entity == "team_member" {
		accountID, _ := payload["accountId"].(string)
		if accountID != "" {
			account, ok := a.store.Accounts[accountID]
			if ok && account.WorkspaceID == auth.WorkspaceID {
				if name, ok := payload["name"].(string); ok && strings.TrimSpace(name) != "" {
					account.Name = strings.TrimSpace(name)
				}
				if email, ok := payload["email"].(string); ok && strings.TrimSpace(email) != "" {
					account.Email = normalizeEmail(email)
				}
				account.UpdatedAt = now
				a.store.Accounts[account.ID] = account
			}
		}
	}
	payload["updatedAt"] = now
	bytes, _ := json.Marshal(payload)
	existing.UserID = auth.AccountID
	existing.AccountID = auth.AccountID
	existing.WorkspaceID = auth.WorkspaceID
	existing.DeviceID = "server"
	existing.UpdatedAt = now
	existing.Revision = a.store.NextRevision
	existing.Payload = bytes
	a.store.NextRevision++
	workspace.Rows[key(existing.Entity, memberID)] = existing
	workspace.UpdatedAt = now
	a.store.Workspaces[auth.WorkspaceID] = workspace
	if err := a.saveLocked(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.notifyWorkspaceChanged(auth.WorkspaceID, a.store.NextRevision-1, "server")
	writeJSON(w, http.StatusOK, memberResponse{Member: existing})
}

func (a *app) withAuth(next func(http.ResponseWriter, *http.Request, authContext)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth, err := a.verifyRequest(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		next(w, r, auth)
	}
}

func (a *app) verifyRequest(r *http.Request) (authContext, error) {
	header := r.Header.Get("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if token == "" || token == header {
		return authContext{}, errors.New("missing bearer token")
	}
	return a.verifyToken(token)
}

func (a *app) verifyEventRequest(r *http.Request) (authContext, error) {
	header := r.Header.Get("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if token == "" || token == header {
		token = strings.TrimSpace(r.URL.Query().Get("token"))
	}
	if token == "" {
		return authContext{}, errors.New("missing bearer token")
	}
	return a.verifyToken(token)
}

func (a *app) signToken(claims tokenClaims) (string, error) {
	bytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(bytes)
	signature := sign(payload, a.cfg.secret)
	return payload + "." + signature, nil
}

func (a *app) verifyToken(token string) (authContext, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return authContext{}, errors.New("invalid token")
	}
	expected := sign(parts[0], a.cfg.secret)
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return authContext{}, errors.New("invalid token signature")
	}
	bytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return authContext{}, errors.New("invalid token payload")
	}
	var claims tokenClaims
	if err := json.Unmarshal(bytes, &claims); err != nil {
		return authContext{}, errors.New("invalid token claims")
	}
	if claims.Exp < time.Now().UTC().Unix() {
		return authContext{}, errors.New("token expired")
	}
	if claims.AccountID == "" {
		claims.AccountID = claims.UserID
	}
	if claims.AccountID == "" || claims.WorkspaceID == "" {
		return authContext{}, errors.New("missing token identity")
	}
	return authContext{AccountID: claims.AccountID, WorkspaceID: claims.WorkspaceID}, nil
}

func sign(payload string, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (a *app) writeLoginResponse(w http.ResponseWriter, deviceID string, account accountRecord, workspace workspaceData) {
	expires := time.Now().UTC().Add(30 * 24 * time.Hour)
	token, err := a.signToken(tokenClaims{
		UserID:      account.ID,
		AccountID:   account.ID,
		WorkspaceID: account.WorkspaceID,
		Exp:         expires.Unix(),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token signing failed")
		return
	}
	publicAccount := account
	publicAccount.PasswordHash = ""
	writeJSON(w, http.StatusOK, loginResponse{
		Token:     token,
		UserID:    account.ID,
		ExpiresAt: expires.Format(time.RFC3339),
		Account:   publicAccount,
		Workspace: publicWorkspace(workspace),
	})
}

func publicWorkspace(workspace workspaceData) workspaceSummary {
	return workspaceSummary{
		ID:        workspace.ID,
		Name:      workspace.Name,
		CreatedAt: workspace.CreatedAt,
		UpdatedAt: workspace.UpdatedAt,
	}
}

func (a *app) accountByEmailLocked(email string) (accountRecord, bool) {
	for _, account := range a.store.Accounts {
		if normalizeEmail(account.Email) == email {
			return account, true
		}
	}
	return accountRecord{}, false
}

func (a *app) authorizeChangeLocked(auth authContext, workspace workspaceData, row syncRow) error {
	if row.DeletedAt != "" && (row.Entity == "project" || row.Entity == "project_member" || row.Entity == "team_member") {
		return errors.New("projects and members cannot be deleted through sync")
	}
	projectID := projectIDFromRow(workspace, row)
	if projectID == "" {
		if row.Entity == "settings" || row.Entity == "onboarding" || row.Entity == "reward_state" || row.Entity == "block_profile" || row.Entity == "daily_plan" || row.Entity == "focus_session" || row.Entity == "interruption" || row.Entity == "strict_violation" {
			return nil
		}
		if row.Entity == "team_member" {
			return nil
		}
		return errors.New("project scoped entity is missing project id")
	}
	if row.Entity == "project" || row.Entity == "project_member" {
		return nil
	}
	return nil
}

func (a *app) canCreateFirstProjectOwnerLocked(auth authContext, workspace workspaceData, row syncRow) bool {
	projectID := stringField(row.Payload, "projectId")
	if projectID == "" || stringField(row.Payload, "accountId") != auth.AccountID || !hasRole(row.Payload, "project_owner") {
		return false
	}
	for _, existing := range workspace.Rows {
		if existing.Entity == "project_member" && existing.DeletedAt == "" && stringField(existing.Payload, "projectId") == projectID {
			return false
		}
	}
	return true
}

func (a *app) isWorkspaceBootstrapOwner(auth authContext, workspace workspaceData) bool {
	for _, row := range workspace.Rows {
		if row.Entity == "project_member" && a.memberBelongsToAccountLocked(workspace, row.ID, auth.AccountID) && hasRole(row.Payload, "project_owner") {
			return true
		}
	}
	return len(workspace.Rows) == 0
}

func (a *app) isProjectOwnerLocked(auth authContext, workspace workspaceData, projectID string) bool {
	for _, row := range workspace.Rows {
		if row.Entity != "project_member" || row.DeletedAt != "" {
			continue
		}
		if stringField(row.Payload, "projectId") == projectID && stringField(row.Payload, "accountId") == auth.AccountID && hasRole(row.Payload, "project_owner") {
			return true
		}
	}
	return false
}

func (a *app) isProjectMemberLocked(auth authContext, workspace workspaceData, projectID string) bool {
	for _, row := range workspace.Rows {
		if row.Entity != "project_member" || row.DeletedAt != "" {
			continue
		}
		if stringField(row.Payload, "projectId") == projectID && stringField(row.Payload, "accountId") == auth.AccountID {
			return true
		}
	}
	return a.isWorkspaceBootstrapOwner(auth, workspace)
}

func (a *app) memberBelongsToAccountLocked(workspace workspaceData, memberID string, accountID string) bool {
	row, ok := workspace.Rows[key("project_member", memberID)]
	return ok && stringField(row.Payload, "accountId") == accountID
}

func projectIDFromRow(workspace workspaceData, row syncRow) string {
	if row.Entity == "project" {
		return row.ID
	}
	if row.Entity == "project_member" || row.Entity == "task" {
		projectID := stringField(row.Payload, "projectId")
		if projectID == "" {
			if existing, ok := workspace.Rows[key(row.Entity, row.ID)]; ok {
				return stringField(existing.Payload, "projectId")
			}
		}
		return projectID
	}
	if row.Entity == "work_session" || row.Entity == "execution_signal" {
		taskID := stringField(row.Payload, "taskId")
		if taskID == "" {
			if existing, ok := workspace.Rows[key(row.Entity, row.ID)]; ok {
				taskID = stringField(existing.Payload, "taskId")
			}
		}
		if taskID == "" {
			return ""
		}
		taskRow, ok := workspace.Rows[key("task", taskID)]
		if !ok {
			return ""
		}
		return stringField(taskRow.Payload, "projectId")
	}
	return ""
}

func taskContainsOwnerReview(payload json.RawMessage) bool {
	return stringField(payload, "reviewAcceptedAt") != "" || stringField(payload, "reviewReturnedAt") != "" || stringField(payload, "reviewAcceptedByMemberId") != "" || stringField(payload, "reviewReturnedByMemberId") != ""
}

func stringField(payload json.RawMessage, field string) string {
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return ""
	}
	raw, _ := value[field].(string)
	return raw
}

func hasRole(payload json.RawMessage, role string) bool {
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return false
	}
	roles, ok := value["roles"].([]any)
	if !ok {
		return false
	}
	for _, item := range roles {
		if item == role {
			return true
		}
	}
	return false
}

func normalizeRoles(roles []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(roles))
	for _, role := range roles {
		role = strings.TrimSpace(role)
		if (role == "project_owner" || role == "executor") && !seen[role] {
			seen[role] = true
			result = append(result, role)
		}
	}
	if len(result) == 0 {
		result = []string{"executor"}
	}
	return result
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func fallback(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func checkPassword(password string, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func newID(prefix string) string {
	var bytes [12]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return prefix + "_" + hex.EncodeToString(bytes[:])
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 8<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("invalid json: %w", err)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
