package authh

import (
	"crypto/subtle"
	"net/http"

	"github.com/pokermap/api/internal/auth"
	"github.com/pokermap/api/internal/httpx"
)

// LoginHandler implements password-based superadmin login.
// The superadmin is identified by SUPERADMIN_USERNAME + SUPERADMIN_PASSWORD
// from env. On success an admin JWT is issued with a synthetic Telegram
// user id of -1 so audit_log rows still have a stable actor.
type LoginHandler struct {
	Username     string
	Password     string
	Issuer       *auth.JWTIssuer
	CookieSecure bool
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

const superadminTelegramID int64 = -1

func NewLogin(username, password string, issuer *auth.JWTIssuer, cookieSecure bool) *LoginHandler {
	return &LoginHandler{
		Username:     username,
		Password:     password,
		Issuer:       issuer,
		CookieSecure: cookieSecure,
	}
}

func (h *LoginHandler) Enabled() bool {
	return h.Username != "" && h.Password != ""
}

func (h *LoginHandler) Login(w http.ResponseWriter, r *http.Request) {
	if !h.Enabled() {
		httpx.Error(w, r, http.StatusServiceUnavailable, "auth_disabled", "superadmin login not configured")
		return
	}
	var req loginRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	// Constant-time comparison to avoid username/password timing oracles.
	userOK := subtle.ConstantTimeCompare([]byte(req.Username), []byte(h.Username)) == 1
	passOK := subtle.ConstantTimeCompare([]byte(req.Password), []byte(h.Password)) == 1
	if !userOK || !passOK {
		httpx.Error(w, r, http.StatusUnauthorized, "invalid_credentials", "bad username or password")
		return
	}
	token, exp, err := h.Issuer.Issue(superadminTelegramID, true, "superadmin", h.Username)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	auth.SetCookie(w, token, exp, h.CookieSecure)
	httpx.JSON(w, http.StatusOK, sessionResponse{
		TelegramUserID: superadminTelegramID,
		IsAdmin:        true,
		FirstName:      "superadmin",
		Username:       h.Username,
	})
}
