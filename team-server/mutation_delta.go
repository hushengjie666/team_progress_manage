package main

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

type mutationContextKey struct{}

type businessDeletedRow struct {
	WorkspaceID string `json:"workspace_id"`
	AccountID   string `json:"account_id,omitempty"`
	Entity      string `json:"entity"`
	ID          string `json:"id"`
	preimage    businessRow
}

type mutationDeltaResponse struct {
	MutationID string               `json:"mutation_id"`
	Delta      bool                 `json:"delta"`
	Rows       []businessRow        `json:"rows"`
	Deleted    []businessDeletedRow `json:"deleted"`
	Settings   map[string]any       `json:"settings"`
	ServerTime string               `json:"server_time"`
}

type mutationRecorder struct {
	mu         sync.Mutex
	mutationID string
	rows       map[string]businessRow
	deleted    map[string]businessDeletedRow
	settings   map[string]any
}

func newMutationRecorder(requestedID string) *mutationRecorder {
	requestedID = strings.TrimSpace(requestedID)
	if requestedID == "" {
		requestedID = newID("mutation")
	}
	return &mutationRecorder{
		mutationID: requestedID,
		rows:       map[string]businessRow{},
		deleted:    map[string]businessDeletedRow{},
		settings:   map[string]any{},
	}
}

func withMutationRecorder(ctx context.Context, requestedID string) (context.Context, *mutationRecorder) {
	recorder := newMutationRecorder(requestedID)
	return context.WithValue(ctx, mutationContextKey{}, recorder), recorder
}

func mutationRecorderFromContext(ctx context.Context) *mutationRecorder {
	recorder, _ := ctx.Value(mutationContextKey{}).(*mutationRecorder)
	return recorder
}

func mutationRowIdentity(row businessRow) string {
	return row.WorkspaceID + "\x00" + row.AccountID + "\x00" + row.Entity + "\x00" + row.ID
}

func (r *mutationRecorder) recordRow(row businessRow) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	key := mutationRowIdentity(row)
	r.rows[key] = row
	delete(r.deleted, key)
}

func (r *mutationRecorder) recordDeleted(row businessRow) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	key := mutationRowIdentity(row)
	delete(r.rows, key)
	r.deleted[key] = businessDeletedRow{
		WorkspaceID: row.WorkspaceID,
		AccountID:   row.AccountID,
		Entity:      row.Entity,
		ID:          row.ID,
		preimage:    row,
	}
}

func (r *mutationRecorder) recordSettings(settings map[string]any) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for key, value := range settings {
		r.settings[key] = value
	}
}

func (r *mutationRecorder) response() mutationDeltaResponse {
	r.mu.Lock()
	defer r.mu.Unlock()
	rows := make([]businessRow, 0, len(r.rows))
	for _, row := range r.rows {
		rows = append(rows, row)
	}
	deleted := make([]businessDeletedRow, 0, len(r.deleted))
	for _, item := range r.deleted {
		deleted = append(deleted, item)
	}
	sort.Slice(rows, func(i, j int) bool { return mutationRowIdentity(rows[i]) < mutationRowIdentity(rows[j]) })
	sort.Slice(deleted, func(i, j int) bool {
		left := deleted[i].WorkspaceID + "\x00" + deleted[i].AccountID + "\x00" + deleted[i].Entity + "\x00" + deleted[i].ID
		right := deleted[j].WorkspaceID + "\x00" + deleted[j].AccountID + "\x00" + deleted[j].Entity + "\x00" + deleted[j].ID
		return left < right
	})
	settings := make(map[string]any, len(r.settings))
	for key, value := range r.settings {
		settings[key] = value
	}
	return mutationDeltaResponse{
		MutationID: r.mutationID,
		Delta:      true,
		Rows:       rows,
		Deleted:    deleted,
		Settings:   settings,
		ServerTime: time.Now().UTC().Format(time.RFC3339Nano),
	}
}

func mutationIDFromRequest(r *http.Request) string {
	if value := strings.TrimSpace(r.Header.Get("X-TimeManage-Mutation-ID")); value != "" {
		return value
	}
	return strings.TrimSpace(r.Header.Get("Idempotency-Key"))
}

func writeMutationDelta(w http.ResponseWriter, status int, recorder *mutationRecorder) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(recorder.response())
}
