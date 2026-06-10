package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type config struct {
	addr     string
	dataPath string
	username string
	password string
	secret   string
}

type fileConfig struct {
	Addr     string `json:"addr"`
	DataPath string `json:"data_path"`
	Username string `json:"username"`
	Password string `json:"password"`
	Secret   string `json:"secret"`
}

type store struct {
	NextRevision int64               `json:"next_revision"`
	Users        map[string]userData `json:"users"`
}

type userData struct {
	Rows map[string]syncRow `json:"rows"`
}

type syncRow struct {
	UserID    string          `json:"user_id,omitempty"`
	Entity    string          `json:"entity"`
	ID        string          `json:"id"`
	DeviceID  string          `json:"device_id"`
	UpdatedAt string          `json:"updated_at"`
	DeletedAt string          `json:"deleted_at,omitempty"`
	Version   int             `json:"version"`
	Revision  int64           `json:"revision"`
	Payload   json.RawMessage `json:"payload"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	DeviceID string `json:"device_id"`
}

type loginResponse struct {
	Token     string `json:"token"`
	UserID    string `json:"user_id"`
	ExpiresAt string `json:"expires_at"`
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

type tokenClaims struct {
	UserID string `json:"user_id"`
	Exp    int64  `json:"exp"`
}

type app struct {
	mu    sync.Mutex
	cfg   config
	store store
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
		log.Fatalf("unknown command %q; use serve, service, install, uninstall, start or stop", command)
	}
}

func runHTTPServer(ctx context.Context, cfg config) error {
	s, err := loadStore(cfg.dataPath)
	if err != nil {
		return fmt.Errorf("load store: %w", err)
	}
	api := &app{cfg: cfg, store: s}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", api.handleHealth)
	mux.HandleFunc("/auth/login", api.handleLogin)
	mux.HandleFunc("/sync/status", api.withAuth(api.handleStatus))
	mux.HandleFunc("/sync/pull", api.withAuth(api.handlePull))
	mux.HandleFunc("/sync/push", api.withAuth(api.handlePush))

	log.Printf("TimeManage sync server listening on http://%s", cfg.addr)
	log.Printf("Data file: %s", cfg.dataPath)
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

func defaultConfig() config {
	cfg := config{
		addr:     "127.0.0.1:8787",
		dataPath: "sync-server/data/store.json",
		username: "demo",
		password: "demo",
	}
	cfg.secret = cfg.password + "-local-secret"
	return cfg
}

func parseCLI(args []string) (string, config, string, error) {
	command := "serve"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		command = strings.ToLower(strings.TrimSpace(args[0]))
		args = args[1:]
	}
	fs := flag.NewFlagSet(command, flag.ContinueOnError)
	configPath := fs.String("config", "", "path to JSON config file")
	addr := fs.String("addr", "", "listen address")
	dataPath := fs.String("data", "", "data file path")
	username := fs.String("user", "", "login username")
	password := fs.String("password", "", "login password")
	secret := fs.String("secret", "", "token signing secret")
	if err := fs.Parse(args); err != nil {
		return command, config{}, "", err
	}

	cfg := defaultConfig()
	if *configPath != "" {
		if err := applyConfigFile(&cfg, *configPath); err != nil {
			return command, config{}, *configPath, err
		}
	}
	applyEnv(&cfg)
	provided := map[string]bool{}
	fs.Visit(func(flag *flag.Flag) {
		provided[flag.Name] = true
	})
	if provided["addr"] {
		cfg.addr = *addr
	}
	if provided["data"] {
		cfg.dataPath = *dataPath
	}
	if provided["user"] {
		cfg.username = *username
	}
	if provided["password"] {
		cfg.password = *password
	}
	if provided["secret"] {
		cfg.secret = *secret
	}
	if cfg.secret == "" {
		cfg.secret = cfg.password + "-local-secret"
	}
	return command, cfg, *configPath, nil
}

func applyConfigFile(cfg *config, path string) error {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var file fileConfig
	if err := json.Unmarshal(bytes, &file); err != nil {
		return err
	}
	if strings.TrimSpace(file.Addr) != "" {
		cfg.addr = strings.TrimSpace(file.Addr)
	}
	if strings.TrimSpace(file.DataPath) != "" {
		cfg.dataPath = strings.TrimSpace(file.DataPath)
	}
	if strings.TrimSpace(file.Username) != "" {
		cfg.username = strings.TrimSpace(file.Username)
	}
	if strings.TrimSpace(file.Password) != "" {
		cfg.password = strings.TrimSpace(file.Password)
	}
	if strings.TrimSpace(file.Secret) != "" {
		cfg.secret = strings.TrimSpace(file.Secret)
	}
	return nil
}

func applyEnv(cfg *config) {
	cfg.addr = env("TM_SYNC_ADDR", cfg.addr)
	cfg.dataPath = env("TM_SYNC_DATA_PATH", env("TM_SYNC_DATA", cfg.dataPath))
	cfg.username = env("TM_SYNC_USER", cfg.username)
	cfg.password = env("TM_SYNC_PASSWORD", cfg.password)
	cfg.secret = env("TM_SYNC_SECRET", cfg.secret)
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func loadStore(path string) (store, error) {
	s := store{NextRevision: 1, Users: map[string]userData{}}
	bytes, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return s, err
	}
	if len(bytes) == 0 {
		return s, nil
	}
	if err := json.Unmarshal(bytes, &s); err != nil {
		return s, err
	}
	if s.NextRevision < 1 {
		s.NextRevision = 1
	}
	if s.Users == nil {
		s.Users = map[string]userData{}
	}
	return s, nil
}

func (a *app) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(a.cfg.dataPath), 0o755); err != nil {
		return err
	}
	bytes, err := json.MarshalIndent(a.store, "", "  ")
	if err != nil {
		return err
	}
	tmp := a.cfg.dataPath + ".tmp"
	if err := os.WriteFile(tmp, bytes, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, a.cfg.dataPath)
}

func (a *app) userLocked(userID string) userData {
	current := a.store.Users[userID]
	if current.Rows == nil {
		current.Rows = map[string]syncRow{}
		a.store.Users[userID] = current
	}
	return current
}

func key(entity, id string) string {
	return entity + "/" + id
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

func (a *app) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req loginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Username != a.cfg.username || req.Password != a.cfg.password {
		writeError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}

	expires := time.Now().UTC().Add(30 * 24 * time.Hour)
	token, err := a.signToken(tokenClaims{UserID: req.Username, Exp: expires.Unix()})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token signing failed")
		return
	}
	writeJSON(w, http.StatusOK, loginResponse{
		Token:     token,
		UserID:    req.Username,
		ExpiresAt: expires.Format(time.RFC3339),
	})
}

func (a *app) handleStatus(w http.ResponseWriter, r *http.Request, userID string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	user := a.userLocked(userID)
	writeJSON(w, http.StatusOK, map[string]any{
		"user_id":          userID,
		"rows":             len(user.Rows),
		"current_revision": a.store.NextRevision - 1,
	})
}

func (a *app) handlePull(w http.ResponseWriter, r *http.Request, userID string) {
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
	user := a.userLocked(userID)
	rows := make([]syncRow, 0)
	for _, row := range user.Rows {
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

func (a *app) handlePush(w http.ResponseWriter, r *http.Request, userID string) {
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

	user := a.userLocked(userID)
	accepted := make([]syncRow, 0, len(req.Changes))
	conflicts := make([]syncRow, 0)

	for _, change := range req.Changes {
		change.UserID = userID
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

		rowKey := key(change.Entity, change.ID)
		existing, found := user.Rows[rowKey]
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
		user.Rows[rowKey] = change
		accepted = append(accepted, change)
	}
	a.store.Users[userID] = user

	if len(accepted) > 0 {
		if err := a.saveLocked(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}

	writeJSON(w, http.StatusOK, pushResponse{
		Accepted:        accepted,
		Conflicts:       conflicts,
		CurrentRevision: a.store.NextRevision - 1,
	})
}

func (a *app) withAuth(next func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := a.verifyRequest(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		next(w, r, userID)
	}
}

func (a *app) verifyRequest(r *http.Request) (string, error) {
	header := r.Header.Get("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if token == "" || token == header {
		return "", errors.New("missing bearer token")
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

func (a *app) verifyToken(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", errors.New("invalid token")
	}
	expected := sign(parts[0], a.cfg.secret)
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return "", errors.New("invalid token signature")
	}
	bytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", errors.New("invalid token payload")
	}
	var claims tokenClaims
	if err := json.Unmarshal(bytes, &claims); err != nil {
		return "", errors.New("invalid token claims")
	}
	if claims.Exp < time.Now().UTC().Unix() {
		return "", errors.New("token expired")
	}
	if claims.UserID == "" {
		return "", errors.New("missing token user")
	}
	return claims.UserID, nil
}

func sign(payload string, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
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
