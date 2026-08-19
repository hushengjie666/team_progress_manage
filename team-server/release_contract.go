package main

import (
	"net/http"
	"strconv"
	"strings"
)

const (
	releaseVersion              = "0.2.9"
	serverReleaseVersion        = "v" + releaseVersion
	apiProtocolVersion    int64 = 2
	databaseSchemaVersion int64 = 12
	minimumClientRelease        = "0.2.9"
)

func parseReleaseVersion(value string) ([3]int, bool) {
	parts := strings.Split(strings.TrimPrefix(strings.TrimSpace(value), "v"), ".")
	if len(parts) != 3 {
		return [3]int{}, false
	}
	var parsed [3]int
	for index, part := range parts {
		value, err := strconv.Atoi(part)
		if err != nil || value < 0 {
			return [3]int{}, false
		}
		parsed[index] = value
	}
	return parsed, true
}

func releaseVersionAtLeast(actual string, minimum string) bool {
	parsedActual, actualOK := parseReleaseVersion(actual)
	parsedMinimum, minimumOK := parseReleaseVersion(minimum)
	if !actualOK || !minimumOK {
		return false
	}
	for index := range parsedActual {
		if parsedActual[index] != parsedMinimum[index] {
			return parsedActual[index] > parsedMinimum[index]
		}
	}
	return true
}

func clientRequestCompatible(r *http.Request) bool {
	protocol, err := strconv.ParseInt(strings.TrimSpace(r.Header.Get("X-TimeManage-API-Protocol")), 10, 64)
	return err == nil &&
		protocol == apiProtocolVersion &&
		releaseVersionAtLeast(r.Header.Get("X-TimeManage-Client-Release"), minimumClientRelease)
}

func writeClientUpgradeRequired(w http.ResponseWriter) {
	writeJSON(w, http.StatusUpgradeRequired, map[string]any{
		"code":                    "client_upgrade_required",
		"error":                   "客户端版本过旧，请升级 TimeManage",
		"server_release":          releaseVersion,
		"required_client_release": minimumClientRelease,
		"api_protocol_version":    apiProtocolVersion,
	})
}

func (a *app) withClientCompatibility(next func(http.ResponseWriter, *http.Request, authContext)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !clientRequestCompatible(r) {
			writeClientUpgradeRequired(w)
			return
		}
		a.withAuth(next)(w, r)
	}
}

type statusResponseWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusResponseWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusResponseWriter) Write(body []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(body)
}

func (a *app) withClientCompatibilityMetadata(next func(http.ResponseWriter, *http.Request, authContext)) http.HandlerFunc {
	return a.withClientCompatibility(func(w http.ResponseWriter, r *http.Request, auth authContext) {
		tracked := &statusResponseWriter{ResponseWriter: w}
		next(tracked, r, auth)
		status := tracked.status
		if status == 0 {
			status = http.StatusOK
		}
		if r.Method != http.MethodGet && status >= 200 && status < 300 {
			a.broadcastMetadataChanged(auth)
		}
	})
}

func (a *app) handleLegacyTeamData(w http.ResponseWriter, _ *http.Request) {
	writeClientUpgradeRequired(w)
}
