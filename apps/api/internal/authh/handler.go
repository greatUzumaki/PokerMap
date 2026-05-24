// Package authh hosts the auth HTTP handlers (kept separate from internal/auth
// so the latter contains only domain logic).
package authh

import (
	"errors"
	"net/http"
	"time"

	"github.com/pokermap/api/internal/auth"
	"github.com/pokermap/api/internal/db"
	"github.com/pokermap/api/internal/events"
	"github.com/pokermap/api/internal/httpx"
	"github.com/pokermap/api/internal/users"
)

type Handler struct {
	Q              *db.Queries
	Issuer         *auth.JWTIssuer
	BotToken       string
	CookieSecure   bool
	NowFn          func() time.Time
	HasPlaceholder bool
	Users          *users.Store
	Events         *events.Store
}

func New(q *db.Queries, issuer *auth.JWTIssuer, botToken string, cookieSecure, hasPlaceholder bool, u *users.Store, e *events.Store) *Handler {
	return &Handler{
		Q:              q,
		Issuer:         issuer,
		BotToken:       botToken,
		CookieSecure:   cookieSecure,
		HasPlaceholder: hasPlaceholder,
		Users:          u,
		Events:         e,
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
	// Persist / refresh the user record before consulting admin role so that
	// the FK admins.telegram_user_id → users is always satisfied.
	if h.Users != nil {
		_ = h.Users.Upsert(r.Context(), users.UpsertInput{
			TelegramUserID:  user.ID,
			FirstName:       user.FirstName,
			LastName:        user.LastName,
			Username:        nonEmpty(user.Username),
			LanguageCode:    nonEmpty(user.LanguageCode),
			IsPremium:       user.IsPremium,
			IsBot:           user.IsBot,
			PhotoURL:        nonEmpty(user.PhotoURL),
			AllowsWriteToPM: user.AllowsWriteToPM,
		})
	}
	isAdmin, err := h.Q.IsAdmin(r.Context(), user.ID)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	if h.Events != nil {
		_ = h.Events.Record(r.Context(), events.RecordInput{
			Kind:           events.KindAppOpen,
			TelegramUserID: user.ID,
			Payload: map[string]any{
				"isPremium":    user.IsPremium,
				"languageCode": user.LanguageCode,
			},
			UserAgent: r.Header.Get("User-Agent"),
		})
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

func nonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
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
