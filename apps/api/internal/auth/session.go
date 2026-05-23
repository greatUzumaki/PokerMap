package auth

import (
	"context"
	"net/http"
	"time"
)

const (
	CookieName      = "pm_session"
	CookieSameSite  = http.SameSiteLaxMode
	contextKeyUser  = ctxKey("user")
)

type ctxKey string

type User struct {
	TelegramUserID int64
	IsAdmin        bool
	FirstName      string
	Username       string
}

func SetCookie(w http.ResponseWriter, token string, exp time.Time, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		Expires:  exp,
		MaxAge:   int(time.Until(exp).Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: CookieSameSite,
	})
}

func ClearCookie(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: CookieSameSite,
	})
}

func WithUser(ctx context.Context, u User) context.Context {
	return context.WithValue(ctx, contextKeyUser, u)
}

func FromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(contextKeyUser).(User)
	return u, ok
}
