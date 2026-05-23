package health

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pokermap/api/internal/cache"
	"github.com/pokermap/api/internal/httpx"
	"github.com/pokermap/api/internal/media"
)

type Handler struct {
	Pool  *pgxpool.Pool
	Media *media.Service
	Cache cache.Cache
}

func New(pool *pgxpool.Pool, m *media.Service, c cache.Cache) *Handler {
	return &Handler{Pool: pool, Media: m, Cache: c}
}

func (h *Handler) Live(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) Ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	report := map[string]string{"db": "ok", "minio": "ok", "cache": "disabled"}
	status := http.StatusOK
	if err := h.Pool.Ping(ctx); err != nil {
		report["db"] = err.Error()
		status = http.StatusServiceUnavailable
	}
	if err := h.Media.Ping(ctx); err != nil {
		report["minio"] = err.Error()
		status = http.StatusServiceUnavailable
	}
	if h.Cache != nil && h.Cache.Enabled() {
		if err := h.Cache.Ping(ctx); err != nil {
			report["cache"] = err.Error()
			status = http.StatusServiceUnavailable
		} else {
			report["cache"] = "ok"
		}
	}
	httpx.JSON(w, status, report)
}
