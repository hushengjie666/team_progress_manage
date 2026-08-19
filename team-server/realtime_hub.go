package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

const realtimeTicketLifetime = 60 * time.Second

type realtimeTicket struct {
	auth      authContext
	expiresAt time.Time
}

type realtimeEvent struct {
	Type    string                 `json:"type"`
	Payload *mutationDeltaResponse `json:"payload,omitempty"`
}

type realtimeConnection struct {
	auth       authContext
	socket     *websocket.Conn
	send       chan realtimeEvent
	overflowed atomic.Bool
}

type realtimeHub struct {
	app         *app
	mu          sync.RWMutex
	tickets     map[string]realtimeTicket
	connections map[*realtimeConnection]struct{}
}

func newRealtimeHub(app *app) *realtimeHub {
	return &realtimeHub{
		app:         app,
		tickets:     map[string]realtimeTicket{},
		connections: map[*realtimeConnection]struct{}{},
	}
}

func (h *realtimeHub) issueTicket(auth authContext) (string, time.Time) {
	ticket := newID("events_ticket")
	expiresAt := time.Now().Add(realtimeTicketLifetime)
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	for key, item := range h.tickets {
		if !item.expiresAt.After(now) {
			delete(h.tickets, key)
		}
	}
	h.tickets[ticket] = realtimeTicket{auth: auth, expiresAt: expiresAt}
	return ticket, expiresAt
}

func (h *realtimeHub) consumeTicket(value string) (authContext, bool) {
	value = strings.TrimSpace(value)
	h.mu.Lock()
	defer h.mu.Unlock()
	ticket, found := h.tickets[value]
	delete(h.tickets, value)
	if !found || !ticket.expiresAt.After(time.Now()) {
		return authContext{}, false
	}
	return ticket.auth, true
}

func (a *app) handleRealtimeTicket(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ticket, expiresAt := a.realtime.issueTicket(auth)
	writeJSON(w, http.StatusCreated, map[string]any{
		"ticket":     ticket,
		"expires_at": expiresAt.UTC().Format(time.RFC3339Nano),
	})
}

var realtimeUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin:     func(_ *http.Request) bool { return true },
}

func (a *app) handleRealtimeEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	auth, ok := a.realtime.consumeTicket(r.URL.Query().Get("ticket"))
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid or expired realtime ticket")
		return
	}
	socket, err := realtimeUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	connection := &realtimeConnection{auth: auth, socket: socket, send: make(chan realtimeEvent, 64)}
	a.realtime.add(connection)
	go a.realtime.writeLoop(connection)
	a.realtime.readLoop(connection)
}

func (h *realtimeHub) add(connection *realtimeConnection) {
	h.mu.Lock()
	h.connections[connection] = struct{}{}
	h.mu.Unlock()
}

func (h *realtimeHub) remove(connection *realtimeConnection) {
	h.mu.Lock()
	delete(h.connections, connection)
	h.mu.Unlock()
	_ = connection.socket.Close()
}

func (h *realtimeHub) readLoop(connection *realtimeConnection) {
	defer h.remove(connection)
	connection.socket.SetReadLimit(4096)
	_ = connection.socket.SetReadDeadline(time.Now().Add(75 * time.Second))
	connection.socket.SetPongHandler(func(string) error {
		return connection.socket.SetReadDeadline(time.Now().Add(75 * time.Second))
	})
	for {
		if _, _, err := connection.socket.ReadMessage(); err != nil {
			return
		}
	}
}

func (h *realtimeHub) writeLoop(connection *realtimeConnection) {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case event, ok := <-connection.send:
			if !ok {
				return
			}
			_ = connection.socket.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := connection.socket.WriteJSON(event); err != nil {
				_ = connection.socket.Close()
				return
			}
		case <-ticker.C:
			_ = connection.socket.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := connection.socket.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second)); err != nil {
				_ = connection.socket.Close()
				return
			}
		}
	}
}

func (a *app) broadcastMutation(source authContext, payload mutationDeltaResponse) {
	if a.realtime == nil {
		return
	}
	go a.realtime.broadcast(source, payload)
}

func (a *app) broadcastMetadataChanged(_ authContext) {
	if a.realtime == nil {
		return
	}
	a.realtime.mu.RLock()
	connections := make([]*realtimeConnection, 0, len(a.realtime.connections))
	for connection := range a.realtime.connections {
		connections = append(connections, connection)
	}
	a.realtime.mu.RUnlock()
	for _, connection := range connections {
		hubEnqueueRealtime(connection, realtimeEvent{Type: "metadata_changed"})
	}
}

func (h *realtimeHub) broadcast(source authContext, payload mutationDeltaResponse) {
	h.mu.RLock()
	connections := make([]*realtimeConnection, 0, len(h.connections))
	for connection := range h.connections {
		connections = append(connections, connection)
	}
	h.mu.RUnlock()
	for _, connection := range connections {
		filtered := h.filterDelta(source, connection.auth, payload)
		if len(filtered.Rows) == 0 && len(filtered.Deleted) == 0 && len(filtered.Settings) == 0 {
			continue
		}
		hubEnqueueRealtime(connection, realtimeEvent{Type: "business_delta", Payload: &filtered})
	}
}

func hubEnqueueRealtime(connection *realtimeConnection, event realtimeEvent) {
	if connection.overflowed.Load() {
		return
	}
	select {
	case connection.send <- event:
	default:
		if connection.overflowed.CompareAndSwap(false, true) {
			select {
			case <-connection.send:
			default:
			}
			select {
			case connection.send <- realtimeEvent{Type: "resync_required"}:
			default:
			}
		}
	}
}

func (h *realtimeHub) filterDelta(source authContext, auth authContext, payload mutationDeltaResponse) mutationDeltaResponse {
	result := payload
	result.Rows = nil
	result.Deleted = nil
	if source.AccountID != auth.AccountID {
		result.Settings = map[string]any{}
	}
	if auth.AccountID == "" {
		result.Settings = map[string]any{}
		return result
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, row := range payload.Rows {
		if h.app.businessRowVisibleToAccount(ctx, auth.AccountID, row) {
			result.Rows = append(result.Rows, row)
		}
	}
	for _, item := range payload.Deleted {
		if h.app.businessRowVisibleToAccount(ctx, auth.AccountID, item.preimage) {
			result.Deleted = append(result.Deleted, item)
		}
	}
	return result
}

func (a *app) businessRowVisibleToAccount(ctx context.Context, accountID string, row businessRow) bool {
	if strings.TrimSpace(row.WorkspaceID) == "" {
		return row.AccountID == accountID
	}
	if _, visible, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, accountID, row.WorkspaceID); err == nil && visible {
		return true
	}
	projectIDs, err := teamProjectIDsForAccount(ctx, a.db, row.WorkspaceID, accountID)
	if err != nil {
		return false
	}
	allowedProjects := map[string]bool{}
	for _, id := range projectIDs {
		allowedProjects[id] = true
	}
	if row.Entity == "reward_state" {
		return row.AccountID == accountID
	}
	if row.Entity == "project" {
		return allowedProjects[row.ID]
	}
	if projectID := businessProjectID(row); projectID != "" {
		return allowedProjects[projectID]
	}
	if row.Entity == "daily_plan" {
		if row.AccountID == accountID {
			return true
		}
		for _, taskID := range businessReferencedTaskIDs(row) {
			if task, found, _ := businessExistingRow(ctx, a.db, row.WorkspaceID, "task", taskID); found && allowedProjects[businessProjectID(task)] {
				return true
			}
		}
		return false
	}
	if taskID := businessTaskID(row); taskID != "" {
		task, found, _ := businessExistingRow(ctx, a.db, row.WorkspaceID, "task", taskID)
		return found && allowedProjects[businessProjectID(task)]
	}
	return row.AccountID == accountID
}

func encodeRealtimeEvent(event realtimeEvent) []byte {
	data, _ := json.Marshal(event)
	return data
}
