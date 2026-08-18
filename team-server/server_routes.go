package main

import "net/http"

func (a *app) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", a.handleHealth)
	mux.HandleFunc("/auth/status", a.handleAuthStatus)
	mux.HandleFunc("/auth/bootstrap", a.handleBootstrap)
	mux.HandleFunc("/auth/login", a.handleLogin)
	mux.HandleFunc("/auth/switch-workspace", a.withClientCompatibility(a.handleSwitchWorkspace))
	mux.HandleFunc("/auth/me", a.withClientCompatibility(a.handleMe))
	mux.HandleFunc("/auth/change-password", a.withClientCompatibility(a.handleChangePassword))
	mux.HandleFunc("/admin/accounts", a.withClientCompatibility(a.handleAdminAccounts))
	mux.HandleFunc("/admin/accounts/", a.withClientCompatibility(a.handleAdminAccountByID))
	mux.HandleFunc("/workspaces", a.withClientCompatibility(a.handleWorkspaces))
	mux.HandleFunc("/workspaces/", a.withClientCompatibility(a.handleWorkspaceByID))
	mux.HandleFunc("/workspace-invitations", a.withClientCompatibility(a.handleWorkspaceInvitations))
	mux.HandleFunc("/workspace-invitations/", a.withClientCompatibility(a.handleWorkspaceInvitationByID))
	mux.HandleFunc("/project-invitations", a.withClientCompatibility(a.handleProjectInvitations))
	mux.HandleFunc("/project-invitations/", a.withClientCompatibility(a.handleProjectInvitationByID))
	mux.HandleFunc("/members", a.withClientCompatibility(a.handleMembers))
	mux.HandleFunc("/members/", a.withClientCompatibility(a.handleMemberByID))
	mux.HandleFunc("/app/bootstrap", a.withClientCompatibility(a.handleAppBootstrap))
	mux.HandleFunc("/app/import", a.withClientCompatibility(a.handleBusinessImport))
	mux.HandleFunc("/settings", a.withClientCompatibility(a.handleAccountSettings))
	mux.HandleFunc("/team/data", a.handleLegacyTeamData)
	mux.HandleFunc("/team/data/", a.handleLegacyTeamData)
	a.registerBusinessResourceRoutes(mux)
}
