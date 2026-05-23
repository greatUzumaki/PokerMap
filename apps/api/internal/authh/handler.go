// Package authh hosts the auth HTTP handlers (kept separate from internal/auth
// so the latter contains only domain logic).
package authh

import (
	"errors"
	"net/http"
	"time"

	"github.com/pokermap/api/internal/auth"
	"github.com/pokermap/api/internal/db"
	"github.com/pokermap/api/internal/httpx"
)

type Handler struct {
	Q              *db.Queries
	Issuer         *auth.JWTIssuer
	BotToken       string
	CookieSecure   bool
	NowFn          func() time.Time
	HasPlaceholder bool
}

func New(q *db.Queries, issuer *auth.JWTIssuer, botToken string, cookieSecure, hasPlaceholder bool) *Handler {
	return &Handler{
		Q:              q,
		Issuer:         issuer,
		BotToken:       botToken,
		CookieSecure:   cookieSecure,
		HasPlaceholder: hasPlaceholder,
		NowFn:          func() time.Time { return time.Now().UTC() },
	}
}

type telegramRequest struct {
	InitData string `json:"initData"`
}

type sessionResponse struct {
	TelegramUserID int64  `json:"telegramUserId"`
	IsAdmin        bool   `json:"isAdmin"`
	FirstName      string `json:"firstName"`
	Username       string `json:"username"`
}

func (h *Handler) Telegram(w http.ResponseWriter, r *http.Request) {
	if h.HasPlaceholder {
		httpx.Error(w, r, http.StatusServiceUnavailable, "auth_disabled", "auth secrets not configured")
		return
	}
	var req telegramRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	user, err := auth.VerifyInitData(req.InitData, h.BotToken, h.NowFn())
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrInitDataExpired):
			httpx.Error(w, r, http.StatusUnauthorized, "initdata_expired", "initData expired")
		default:
			httpx.Error(w, r, http.StatusUnauthorized, "invalid_initdata", "invalid initData")
		}
		return
	}
	isAdmin, err := h.Q.IsAdmin(r.Context(), user.ID)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	token, exp, err := h.Issuer.Issue(user.ID, isAdmin, user.FirstName, user.Username)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	auth.SetCookie(w, token, exp, h.CookieSecure)
	httpx.JSON(w, http.StatusOK, sessionResponse{
		TelegramUserID: user.ID,
		IsAdmin:        isAdmin,
		FirstName:      user.FirstName,
		Username:       user.Username,
	})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	auth.ClearCookie(w, h.CookieSecure)
	httpx.JSON(w, http.StatusNoContent, nil)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, r, http.StatusUnauthorized, "unauthorized", "no session")
		return
	}
	httpx.JSON(w, http.StatusOK, sessionResponse{
		TelegramUserID: u.TelegramUserID,
		IsAdmin:        u.IsAdmin,
		FirstName:      u.FirstName,
		Username:       u.Username,
	})
}
