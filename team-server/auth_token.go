package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

func (a *app) withAuth(next func(http.ResponseWriter, *http.Request, authContext)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth, err := a.verifyRequest(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		if err := a.ensureAuthAccess(r.Context(), auth); err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		next(w, r, auth)
	}
}

func (a *app) ensureAuthAccess(ctx context.Context, auth authContext) error {
	if a.db == nil {
		return errors.New("mysql store unavailable")
	}
	_, ok, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, auth.AccountID, auth.WorkspaceID)
	if err != nil {
		return errors.New("validate workspace access failed")
	}
	if !ok {
		return errors.New("workspace access denied")
	}
	return nil
}

func (a *app) verifyRequest(r *http.Request) (authContext, error) {
	header := r.Header.Get("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if token == "" || token == header {
		return authContext{}, errors.New("missing bearer token")
	}
	return a.verifyToken(token)
}

func (a *app) signToken(claims tokenClaims) (string, error) {
	bytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(bytes)
	signature := sign(payload, a.cfg.secret)
	return payload + "." + signature, nil
}

func (a *app) verifyToken(token string) (authContext, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return authContext{}, errors.New("invalid token")
	}
	expected := sign(parts[0], a.cfg.secret)
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return authContext{}, errors.New("invalid token signature")
	}
	bytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return authContext{}, errors.New("invalid token payload")
	}
	var claims tokenClaims
	if err := json.Unmarshal(bytes, &claims); err != nil {
		return authContext{}, errors.New("invalid token claims")
	}
	if claims.Exp < time.Now().UTC().Unix() {
		return authContext{}, errors.New("token expired")
	}
	if claims.AccountID == "" {
		claims.AccountID = claims.UserID
	}
	if claims.AccountID == "" || claims.WorkspaceID == "" {
		return authContext{}, errors.New("missing token identity")
	}
	return authContext{AccountID: claims.AccountID, WorkspaceID: claims.WorkspaceID}, nil
}

func sign(payload string, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
