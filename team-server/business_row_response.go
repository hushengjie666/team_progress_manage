package main

import "net/http"

func (a *app) writeBootstrapRows(w http.ResponseWriter, r *http.Request, auth authContext) {
	rows, err := a.businessRowsForAccount(r.Context(), auth)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "reload failed")
		return
	}
	writeJSON(w, http.StatusOK, teamDataResponse{Rows: rows})
}
