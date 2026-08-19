package main

import "net/http"

func (a *app) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", a.handleHealth)
	mux.HandleFunc("/auth/status", a.handleAuthStatus)
	mux.HandleFunc("/auth/bootstrap", a.handleBootstrap)
	mux.HandleFunc("/auth/login", a.handleLogin)
	mux.HandleFunc("/auth/switch-workspace", a.withClientCompatibility(a.handleSwitchWorkspace))
	mux.HandleFunc("/auth/me", a.withClientCompatibility(a.handleMe))
	mux.HandleFunc("/auth/change-password", a.withClientCompatibilityMetadata(a.handleChangePassword))
	mux.HandleFunc("/admin/accounts", a.withClientCompatibilityMetadata(a.handleAdminAccounts))
	mux.HandleFunc("/admin/accounts/", a.withClientCompatibilityMetadata(a.handleAdminAccountByID))
	mux.HandleFunc("/workspaces", a.withClientCompatibilityMetadata(a.handleWorkspaces))
	mux.HandleFunc("/workspaces/", a.withClientCompatibilityMetadata(a.handleWorkspaceByID))
	mux.HandleFunc("/workspace-invitations", a.withClientCompatibilityMetadata(a.handleWorkspaceInvitations))
	mux.HandleFunc("/workspace-invitations/", a.withClientCompatibilityMetadata(a.handleWorkspaceInvitationByID))
	mux.HandleFunc("/project-invitations", a.withClientCompatibilityMetadata(a.handleProjectInvitations))
	mux.HandleFunc("/project-invitations/", a.withClientCompatibilityMetadata(a.handleProjectInvitationByID))
	mux.HandleFunc("/members", a.withClientCompatibilityMetadata(a.handleMembers))
	mux.HandleFunc("/members/", a.withClientCompatibilityMetadata(a.handleMemberByID))
	mux.HandleFunc("/app/bootstrap", a.withClientCompatibility(a.handleAppBootstrap))
	mux.HandleFunc("/app/events/ticket", a.withClientCompatibility(a.handleRealtimeTicket))
	mux.HandleFunc("/app/events", a.handleRealtimeEvents)
	mux.HandleFunc("/app/import", a.withClientCompatibility(a.handleBusinessImport))
	mux.HandleFunc("/settings", a.withClientCompatibility(a.handleAccountSettings))
	mux.HandleFunc("/team/data", a.handleLegacyTeamData)
	mux.HandleFunc("/team/data/", a.handleLegacyTeamData)
	a.registerBusinessResourceRoutes(mux)
}
