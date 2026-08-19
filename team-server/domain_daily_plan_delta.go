package main

import (
	"net/http"
	"strings"
)

func (a *app) writeDailyPlanActionDelta(
	w http.ResponseWriter,
	r *http.Request,
	auth authContext,
	workspaceID string,
	planID string,
	taskID string,
) {
	rows := []businessRow{}
	plan, found, err := businessExistingRow(r.Context(), a.db, workspaceID, "daily_plan", planID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "reload failed")
		return
	}
	if found && plan.AccountID == auth.AccountID {
		rows = append(rows, plan)
	}
	if strings.TrimSpace(taskID) != "" {
		task, taskFound, taskErr := businessExistingRow(r.Context(), a.db, workspaceID, "task", taskID)
		if taskErr != nil {
			writeError(w, http.StatusInternalServerError, "reload failed")
			return
		}
		if taskFound {
			allowed, accessErr := businessRowMutationAllowed(r.Context(), a.db, auth, task, task, false)
			if accessErr != nil {
				writeError(w, http.StatusInternalServerError, "reload failed")
				return
			}
			if allowed {
				rows = append(rows, task)
			}
		}
	}
	writeJSON(w, http.StatusOK, teamDataResponse{Rows: rows, Delta: true})
}
