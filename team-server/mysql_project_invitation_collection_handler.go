package main

import "net/http"

func (a *app) handleProjectInvitations(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "project invitations require mysql backend")
		return
	}
	switch r.Method {
	case http.MethodGet:
		a.handleProjectInvitationList(w, r, auth)
	case http.MethodPost:
		a.handleProjectInvitationCreate(w, r, auth)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
