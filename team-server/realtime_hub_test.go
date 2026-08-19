package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestRealtimeWebSocketUpgradeAndBusinessDelta(t *testing.T) {
	api := testApp(t)
	auth := authContext{AccountID: "account_test", WorkspaceID: "workspace_test"}
	ticket, _ := api.realtime.issueTicket(auth)
	server := httptest.NewServer(http.HandlerFunc(api.handleRealtimeEvents))
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http") + "?ticket=" + ticket
	connection, response, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("websocket dial failed: response=%v err=%v", response, err)
	}
	defer connection.Close()

	payload := mutationDeltaResponse{
		MutationID: "mutation_socket",
		Delta:      true,
		Rows:       []businessRow{},
		Deleted:    []businessDeletedRow{},
		Settings:   map[string]any{"soundEnabled": false},
		ServerTime: time.Now().UTC().Format(time.RFC3339Nano),
	}
	api.broadcastMutation(auth, payload)
	_ = connection.SetReadDeadline(time.Now().Add(2 * time.Second))
	var event realtimeEvent
	if err := connection.ReadJSON(&event); err != nil {
		t.Fatal(err)
	}
	if event.Type != "business_delta" || event.Payload == nil || event.Payload.MutationID != payload.MutationID {
		t.Fatalf("unexpected event: %#v", event)
	}

	if _, secondResponse, secondErr := websocket.DefaultDialer.Dial(url, nil); secondErr == nil || secondResponse == nil || secondResponse.StatusCode != 401 {
		t.Fatalf("consumed ticket was accepted again: response=%v err=%v", secondResponse, secondErr)
	}
}

func TestRealtimeSlowConnectionRequiresResync(t *testing.T) {
	api := testApp(t)
	auth := authContext{AccountID: "account_test", WorkspaceID: "workspace_test"}
	connection := &realtimeConnection{auth: auth, send: make(chan realtimeEvent, 64)}
	api.realtime.connections[connection] = struct{}{}
	for index := 0; index < cap(connection.send); index++ {
		connection.send <- realtimeEvent{Type: "heartbeat"}
	}
	api.realtime.broadcast(auth, mutationDeltaResponse{
		MutationID: "mutation_overflow",
		Delta:      true,
		Settings:   map[string]any{"soundEnabled": false},
	})
	if !connection.overflowed.Load() {
		t.Fatal("slow realtime connection was not marked for resync")
	}
	found := false
	for len(connection.send) > 0 {
		if event := <-connection.send; event.Type == "resync_required" {
			found = true
		}
	}
	if !found {
		t.Fatal("resync_required event was not queued")
	}
}
