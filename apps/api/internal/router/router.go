package router

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pokermap/api/internal/authh"
	"github.com/pokermap/api/internal/bot"
	"github.com/pokermap/api/internal/clubs"
	"github.com/pokermap/api/internal/events"
	"github.com/pokermap/api/internal/health"
	pmmw "github.com/pokermap/api/internal/middleware"
	"github.com/pokermap/api/internal/uploads"
	"github.com/pokermap/api/internal/users"
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
	LastSeen          func(http.Handler) http.Handler
	Events            *events.Handler
	Bot               *bot.Handler
	Users             *users.Store
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
		// Bot webhook — public, NO session middleware (Telegram auth via secret-token header).
		if d.Bot != nil {
			r.Post("/tg/webhook", d.Bot.ServeHTTP)
		}

		r.Group(func(r chi.Router) {
			r.Use(d.SessionMiddleware)
			if d.LastSeen != nil {
				r.Use(d.LastSeen)
			}

			r.Post("/auth/telegram", d.Auth.Telegram)
			r.Post("/auth/login", d.Login.Login)
			r.Post("/auth/logout", d.Auth.Logout)
			r.Get("/auth/me", d.Auth.Me)

			// Public event ingestion (auth optional — anonymous bucketing supported).
			if d.Events != nil {
				r.Post("/events", d.Events.Ingest)
			}

			d.Clubs.RegisterPublic(r)

			r.Group(func(r chi.Router) {
				r.Use(pmmw.RequireAdmin)
				d.Clubs.RegisterAdmin(r)
				r.Post("/admin/uploads/sign", d.Uploads.Sign)

				if d.Events != nil {
					r.Get("/admin/events", d.Events.AdminList)
					r.Delete("/admin/events/{id}", d.Events.AdminDelete)
					r.Delete("/admin/events", d.Events.AdminBulkDelete)
				}
				if d.Users != nil {
					ah := &adminUsersHandler{store: d.Users}
					r.Get("/admin/users", ah.list)
					r.Get("/admin/users/{telegramUserId}", ah.get)
				}
			})
		})
	})

	return r
}
