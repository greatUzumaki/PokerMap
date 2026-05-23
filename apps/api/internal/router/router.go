package router

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pokermap/api/internal/authh"
	"github.com/pokermap/api/internal/clubs"
	"github.com/pokermap/api/internal/health"
	pmmw "github.com/pokermap/api/internal/middleware"
	"github.com/pokermap/api/internal/uploads"
)

type Deps struct {
	Logger            *slog.Logger
	CORSOrigins       []string
	Health            *health.Handler
	Auth              *authh.Handler
	Login             *authh.LoginHandler
	Clubs             *clubs.Handler
	Uploads           *uploads.Handler
	SessionMiddleware func(http.Handler) http.Handler
}

func New(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(pmmw.RequestID())
	r.Use(pmmw.Recoverer(d.Logger))
	r.Use(pmmw.AccessLog(d.Logger))
	r.Use(pmmw.CORS(d.CORSOrigins))

	r.Get("/healthz", d.Health.Live)
	r.Get("/readyz", d.Health.Ready)

	r.Route("/v1", func(r chi.Router) {
		r.Use(d.SessionMiddleware)

		r.Post("/auth/telegram", d.Auth.Telegram)
		r.Post("/auth/login", d.Login.Login)
		r.Post("/auth/logout", d.Auth.Logout)
		r.Get("/auth/me", d.Auth.Me)

		d.Clubs.RegisterPublic(r)

		r.Group(func(r chi.Router) {
			r.Use(pmmw.RequireAdmin)
			d.Clubs.RegisterAdmin(r)
			r.Post("/admin/uploads/sign", d.Uploads.Sign)
		})
	})

	return r
}
