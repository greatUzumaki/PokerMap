package router

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/pokermap/api/internal/httpx"
	"github.com/pokermap/api/internal/users"
)

type adminUsersHandler struct {
	store *users.Store
}

func (h *adminUsersHandler) list(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			httpx.Error(w, r, http.StatusBadRequest, "invalid_limit", "limit must be positive integer")
			return
		}
		limit = n
	}
	items, err := h.store.List(r.Context(), users.ListParams{Q: q, Limit: limit})
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items, "nextCursor": nil})
}

func (h *adminUsersHandler) get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "telegramUserId")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_id", "telegramUserId must be integer")
		return
	}
	p, err := h.store.Get(r.Context(), id)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			httpx.Error(w, r, http.StatusNotFound, "not_found", "user not found")
			return
		}
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}
