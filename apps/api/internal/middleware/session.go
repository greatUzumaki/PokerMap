package middleware

import (
	"errors"
	"net/http"

	"github.com/pokermap/api/internal/auth"
	"github.com/pokermap/api/internal/httpx"
)

func Session(issuer *auth.JWTIssuer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(auth.CookieName)
			if err != nil || cookie.Value == "" {
				next.ServeHTTP(w, r)
				return
			}
			claims, err := issuer.Parse(cookie.Value)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			user := auth.User{
				TelegramUserID: claims.TelegramUserID,
				IsAdmin:        claims.IsAdmin,
				FirstName:      claims.FirstName,
				Username:       claims.Username,
			}
			next.ServeHTTP(w, r.WithContext(auth.WithUser(r.Context(), user)))
		})
	}
}

func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := auth.FromContext(r.Context())
		if !ok {
			httpx.Error(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
			return
		}
		if !u.IsAdmin {
			httpx.Error(w, r, http.StatusForbidden, "forbidden", "admin role required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

var ErrUnauthorized = errors.New("unauthorized")
