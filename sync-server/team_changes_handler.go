package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleTeamChanges(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusServiceUnavailable, "team api requires mysql storage")
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
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	nextRevision, err := mysqlNextRevisionForUpdate(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	for _, change := range req.Changes {
		targetWorkspaceID := teamWorkspaceIDForChange(auth, change)
		if strings.TrimSpace(targetWorkspaceID) == "" {
			continue
		}
		change.UserID = auth.AccountID
		change.AccountID = auth.AccountID
		change.WorkspaceID = targetWorkspaceID
		change.DeviceID = req.DeviceID
		change.Entity = strings.TrimSpace(change.Entity)
		change.ID = strings.TrimSpace(change.ID)
		if change.Entity == "" || change.ID == "" {
			continue
		}
		if _, ok := teamTableForEntity(change.Entity); !ok {
			continue
		}
		if change.UpdatedAt == "" {
			change.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
		}
		if !json.Valid(change.Payload) || len(change.Payload) == 0 {
			change.Payload = json.RawMessage(`{}`)
		}
		if change.Version == 0 {
			change.Version = 1
		}
		if _, found, err := mysqlWorkspaceVisibleToAccount(ctx, tx, auth.AccountID, targetWorkspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if !found {
			projectID, err := teamProjectIDForWriteRow(ctx, tx, targetWorkspaceID, change)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			allowed, err := teamAccountCanAccessProject(ctx, tx, targetWorkspaceID, auth.AccountID, projectID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			if !allowed {
				writeError(w, http.StatusForbidden, "workspace access denied")
				return
			}
		}
		change.Revision = nextRevision
		nextRevision++
		if err := teamUpsertRow(ctx, tx, change); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	if err := mysqlSetNextRevision(ctx, tx, nextRevision); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	currentRevision := nextRevision - 1
	writeJSON(w, http.StatusOK, pushResponse{CurrentRevision: currentRevision})
}
