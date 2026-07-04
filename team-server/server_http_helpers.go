package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

func requestForceRecreate(r *http.Request) bool {
	return strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("force_recreate")), "1") ||
		strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("force_recreate")), "true") ||
		strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("force")), "1") ||
		strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("force")), "true")
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
