package main

import "net/http"

func (a *app) handleWorkspaceInvitations(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "workspace invitations require mysql backend")
		return
	}
	switch r.Method {
	case http.MethodGet:
		a.handleWorkspaceInvitationList(w, r, auth)
	case http.MethodPost:
		a.handleWorkspaceInvitationCreate(w, r, auth)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
