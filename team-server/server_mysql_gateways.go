package main

import "net/http"

func (a *app) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleAuthStatusMySQL(w, r)
}

func (a *app) handleBootstrap(w http.ResponseWriter, r *http.Request) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleBootstrapMySQL(w, r)
}

func (a *app) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleLoginMySQL(w, r)
}

func (a *app) handleSwitchWorkspace(w http.ResponseWriter, r *http.Request, auth authContext) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleSwitchWorkspaceMySQL(w, r, auth)
}

func (a *app) handleWorkspaces(w http.ResponseWriter, r *http.Request, auth authContext) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleWorkspacesMySQL(w, r, auth)
}

func (a *app) handleWorkspaceByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleWorkspaceByIDMySQL(w, r, auth)
}

func (a *app) handleMe(w http.ResponseWriter, r *http.Request, auth authContext) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleMeMySQL(w, r, auth)
}

func (a *app) handleChangePassword(w http.ResponseWriter, r *http.Request, auth authContext) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleChangePasswordMySQL(w, r, auth)
}

func (a *app) handleMembers(w http.ResponseWriter, r *http.Request, auth authContext) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleMembersMySQL(w, r, auth)
}

func (a *app) handleMemberByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if !a.requireMySQL(w) {
		return
	}
	a.handleMemberByIDMySQL(w, r, auth)
}
