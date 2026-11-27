package main

import (
	"context"
	"database/sql"
	"net/http"
	"time"
)

// The task row is already locked. Check-ins are shared and a repeated date is idempotent.
func completeDailyTaskInTx(ctx context.Context, tx *sql.Tx, task businessRow, payload map[string]any, date, now string) *taskReviewFailure {
	if _, err := time.Parse(time.DateOnly, date); err != nil {
		return &taskReviewFailure{http.StatusBadRequest, "a local completion date is required"}
	}
	if status := payload["status"]; status == "archived" || status == "split" {
		return &taskReviewFailure{http.StatusConflict, "task cannot be completed"}
	}
	dates := stringSliceField(task.Payload, "dailyCompletedDates")
	if containsString(dates, date) {
		return nil
	}
	if err := endTaskWorkSessionsInTx(ctx, tx, task, now, "skipped"); err != nil {
		return &taskReviewFailure{http.StatusInternalServerError, "end daily task sessions failed"}
	}
	payload["dailyCompletedDates"] = append(dates, date)
	payload["status"] = "pool"
	return nil
}
