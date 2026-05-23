package clubs

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pokermap/api/internal/auth"
	"github.com/pokermap/api/internal/cache"
	"github.com/pokermap/api/internal/cursor"
	"github.com/pokermap/api/internal/db"
	"github.com/pokermap/api/internal/httpx"
	"github.com/pokermap/api/internal/validate"
)

type Handler struct {
	Q      *db.Queries
	Cache  cache.Cache
	TTL    time.Duration
	Logger *slog.Logger
}

func New(q *db.Queries, c cache.Cache, ttl time.Duration, logger *slog.Logger) *Handler {
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	return &Handler{Q: q, Cache: c, TTL: ttl, Logger: logger}
}

func (h *Handler) invalidate(r *http.Request) {
	if h.Cache == nil {
		return
	}
	if err := h.Cache.Invalidate(r.Context(), "clubs:*"); err != nil {
		h.Logger.WarnContext(r.Context(), "cache invalidate", "err", err)
	}
}

func (h *Handler) RegisterPublic(r chi.Router) {
	r.Get("/clubs", h.list)
	r.Get("/clubs/{slug}", h.getBySlug)
}

func (h *Handler) RegisterAdmin(r chi.Router) {
	r.Get("/admin/clubs", h.listAdmin)
	r.Post("/admin/clubs", h.create)
	r.Get("/admin/clubs/{id}", h.getByID)
	r.Put("/admin/clubs/{id}", h.update)
	r.Delete("/admin/clubs/{id}", h.archive)
	r.Get("/admin/clubs/{id}/history", h.history)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := parseLimit(q.Get("limit"), 50, 100)

	cur, err := cursor.Decode(q.Get("cursor"))
	if err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_cursor", "invalid cursor")
		return
	}
	params := db.ListPublishedClubsParams{Limit: int32(limit)}
	if !cur.CreatedAt.IsZero() {
		params.CursorCreatedAt = &cur.CreatedAt
		params.CursorID = &cur.ID
	}
	if bbox := q.Get("bbox"); bbox != "" {
		parts := strings.Split(bbox, ",")
		if len(parts) != 4 {
			httpx.Error(w, r, http.StatusBadRequest, "invalid_bbox", "expected minLng,minLat,maxLng,maxLat")
			return
		}
		vals := make([]float64, 4)
		for i, p := range parts {
			v, err := strconv.ParseFloat(strings.TrimSpace(p), 64)
			if err != nil {
				httpx.Error(w, r, http.StatusBadRequest, "invalid_bbox", "bbox component is not a number")
				return
			}
			vals[i] = v
		}
		params.MinLng, params.MinLat, params.MaxLng, params.MaxLat = &vals[0], &vals[1], &vals[2], &vals[3]
	}

	cacheKey := "clubs:list:" + r.URL.RawQuery
	var cached ClubsList
	if hit, _ := h.Cache.Get(r.Context(), cacheKey, &cached); hit {
		w.Header().Set("X-Cache", "HIT")
		httpx.JSON(w, http.StatusOK, cached)
		return
	}

	rows, err := h.Q.ListPublishedClubs(r.Context(), params)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	out := ClubsList{Items: make([]ClubDTO, 0, len(rows))}
	for _, c := range rows {
		out.Items = append(out.Items, ToDTO(c))
	}
	if len(rows) == limit {
		last := rows[len(rows)-1]
		next := cursor.Encode(cursor.Cursor{CreatedAt: last.CreatedAt, ID: last.ID})
		out.NextCursor = &next
	}
	if err := h.Cache.Set(r.Context(), cacheKey, out, h.TTL); err != nil {
		h.Logger.WarnContext(r.Context(), "cache set", "key", cacheKey, "err", err)
	}
	w.Header().Set("X-Cache", "MISS")
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) getBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	cacheKey := "clubs:slug:" + slug
	var cached ClubDTO
	if hit, _ := h.Cache.Get(r.Context(), cacheKey, &cached); hit {
		w.Header().Set("X-Cache", "HIT")
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	c, err := h.Q.GetClubBySlug(r.Context(), slug)
	if errors.Is(err, db.ErrNotFound) {
		httpx.Error(w, r, http.StatusNotFound, "not_found", "club not found")
		return
	}
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	dto := ToDTO(c)
	if err := h.Cache.Set(r.Context(), cacheKey, dto, h.TTL); err != nil {
		h.Logger.WarnContext(r.Context(), "cache set", "key", cacheKey, "err", err)
	}
	w.Header().Set("X-Cache", "MISS")
	httpx.JSON(w, http.StatusOK, dto)
}

func (h *Handler) listAdmin(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := parseLimit(q.Get("limit"), 50, 200)
	offset, _ := strconv.Atoi(q.Get("offset"))
	if offset < 0 {
		offset = 0
	}
	rows, err := h.Q.ListAllClubsAdmin(r.Context(), int32(limit), int32(offset))
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	total, _ := h.Q.CountAllClubsAdmin(r.Context())
	items := make([]ClubDTO, 0, len(rows))
	for _, c := range rows {
		items = append(items, ToDTO(c))
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"items": items,
		"total": total,
	})
}

func (h *Handler) getByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_id", "id must be a uuid")
		return
	}
	c, err := h.Q.GetClubByID(r.Context(), id)
	if errors.Is(err, db.ErrNotFound) {
		httpx.Error(w, r, http.StatusNotFound, "not_found", "club not found")
		return
	}
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, ToDTO(c))
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := validate.V().Struct(req); err != nil {
		httpx.Error(w, r, http.StatusUnprocessableEntity, "validation", "validation failed", validate.Details(err)...)
		return
	}
	if req.WorkingHours == nil {
		req.WorkingHours = json.RawMessage(`{}`)
	}
	status := db.ClubStatus(req.Status)
	if status == "" {
		status = db.ClubStatusDraft
	}
	created, err := h.Q.CreateClub(r.Context(), db.CreateClubParams{
		Slug:            req.Slug,
		Name:            req.Name,
		Address:         req.Address,
		Lat:             req.Lat,
		Lng:             req.Lng,
		Description:     req.Description,
		Phones:          orEmpty(req.Phones),
		Website:         req.Website,
		TelegramURL:     req.TelegramURL,
		WorkingHours:    req.WorkingHours,
		Games:           orEmpty(req.Games),
		MinBuyInCents:   req.MinBuyInCents,
		MaxBuyInCents:   req.MaxBuyInCents,
		RakeDescription: req.RakeDescription,
		PhotoKeys:       orEmpty(req.PhotoKeys),
		Status:          status,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httpx.Error(w, r, http.StatusConflict, "slug_taken", "slug already in use")
			return
		}
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	h.writeAudit(r, "create", created.ID, map[string]any{"after": ToDTO(created)})
	h.invalidate(r)
	w.Header().Set("Location", "/v1/admin/clubs/"+created.ID.String())
	httpx.JSON(w, http.StatusCreated, ToDTO(created))
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_id", "id must be a uuid")
		return
	}
	var req UpdateRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := validate.V().Struct(req); err != nil {
		httpx.Error(w, r, http.StatusUnprocessableEntity, "validation", "validation failed", validate.Details(err)...)
		return
	}
	before, err := h.Q.GetClubByID(r.Context(), id)
	if errors.Is(err, db.ErrNotFound) {
		httpx.Error(w, r, http.StatusNotFound, "not_found", "club not found")
		return
	}
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	var status *db.ClubStatus
	if req.Status != nil {
		s := db.ClubStatus(*req.Status)
		status = &s
	}
	after, err := h.Q.UpdateClub(r.Context(), db.UpdateClubParams{
		ID:              id,
		Slug:            req.Slug,
		Name:            req.Name,
		Address:         req.Address,
		Lat:             req.Lat,
		Lng:             req.Lng,
		Description:     req.Description,
		Phones:          req.Phones,
		Website:         req.Website,
		TelegramURL:     req.TelegramURL,
		WorkingHours:    req.WorkingHours,
		Games:           req.Games,
		MinBuyInCents:   req.MinBuyInCents,
		MaxBuyInCents:   req.MaxBuyInCents,
		RakeDescription: req.RakeDescription,
		PhotoKeys:       req.PhotoKeys,
		Status:          status,
	})
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	h.writeAudit(r, "update", id, map[string]any{"before": ToDTO(before), "after": ToDTO(after)})
	h.invalidate(r)
	httpx.JSON(w, http.StatusOK, ToDTO(after))
}

func (h *Handler) archive(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_id", "id must be a uuid")
		return
	}
	c, err := h.Q.ArchiveClub(r.Context(), id)
	if errors.Is(err, db.ErrNotFound) {
		httpx.Error(w, r, http.StatusNotFound, "not_found", "club not found")
		return
	}
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	h.writeAudit(r, "archive", id, map[string]any{"after": ToDTO(c)})
	h.invalidate(r)
	httpx.JSON(w, http.StatusOK, ToDTO(c))
}

func (h *Handler) history(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_id", "id must be a uuid")
		return
	}
	rows, err := h.Q.ListAuditLogForEntity(r.Context(), "club", id, 200)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": rows})
}

func (h *Handler) writeAudit(r *http.Request, action string, id uuid.UUID, diff map[string]any) {
	user, ok := auth.FromContext(r.Context())
	if !ok {
		return
	}
	b, _ := json.Marshal(diff)
	_ = h.Q.InsertAuditLog(r.Context(), db.InsertAuditLogParams{
		Actor:      user.TelegramUserID,
		Action:     action,
		EntityType: "club",
		EntityID:   id,
		Diff:       b,
	})
}

func parseLimit(raw string, dflt, max int) int {
	if raw == "" {
		return dflt
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return dflt
	}
	if n > max {
		return max
	}
	return n
}

func orEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
