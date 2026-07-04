package main

import "net/http"

func (a *app) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", a.handleHealth)
	mux.HandleFunc("/auth/status", a.handleAuthStatus)
	mux.HandleFunc("/auth/bootstrap", a.handleBootstrap)
	mux.HandleFunc("/auth/login", a.handleLogin)
	mux.HandleFunc("/auth/switch-workspace", a.withAuth(a.handleSwitchWorkspace))
	mux.HandleFunc("/auth/me", a.withAuth(a.handleMe))
	mux.HandleFunc("/auth/change-password", a.withAuth(a.handleChangePassword))
	mux.HandleFunc("/admin/accounts", a.withAuth(a.handleAdminAccounts))
	mux.HandleFunc("/admin/accounts/", a.withAuth(a.handleAdminAccountByID))
	mux.HandleFunc("/workspaces", a.withAuth(a.handleWorkspaces))
	mux.HandleFunc("/workspaces/", a.withAuth(a.handleWorkspaceByID))
	mux.HandleFunc("/workspace-invitations", a.withAuth(a.handleWorkspaceInvitations))
	mux.HandleFunc("/workspace-invitations/", a.withAuth(a.handleWorkspaceInvitationByID))
	mux.HandleFunc("/project-invitations", a.withAuth(a.handleProjectInvitations))
	mux.HandleFunc("/project-invitations/", a.withAuth(a.handleProjectInvitationByID))
	mux.HandleFunc("/members", a.withAuth(a.handleMembers))
	mux.HandleFunc("/members/", a.withAuth(a.handleMemberByID))
	mux.HandleFunc("/team/data", a.withAuth(a.handleTeamData))
}
