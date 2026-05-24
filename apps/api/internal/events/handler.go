package events

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/pokermap/api/internal/auth"
	"github.com/pokermap/api/internal/httpx"
	"github.com/redis/go-redis/v9"
)

const (
	maxBatch         = 10
	maxPayloadBytes  = 4 * 1024
	rateWindow10s   = 20
	rateWindowMinute = 200
)

type Handler struct {
	Store *Store
	RDB   *redis.Client
}

func NewHandler(s *Store, rdb *redis.Client) *Handler {
	return &Handler{Store: s, RDB: rdb}
}

type clientEvent struct {
	Kind       string          `json:"kind"`
	Payload    json.RawMessage `json:"payload,omitempty"`
	OccurredAt string          `json:"occurredAt,omitempty"`
}

type batchRequest struct {
	Events []clientEvent `json:"events"`
}

// Ingest is POST /v1/events — public, rate-limited, anonymous-friendly.
func (h *Handler) Ingest(w http.ResponseWriter, r *http.Request) {
	if r.ContentLength > int64(maxPayloadBytes*maxBatch+1024) {
		httpx.Error(w, r, http.StatusRequestEntityTooLarge, "too_large", "batch too large")
		return
	}
	var body batchRequest
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if len(body.Events) == 0 || len(body.Events) > maxBatch {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_batch", "batch must contain 1..10 events")
		return
	}

	// Validate kinds + payload sizes up front so we reject the whole batch atomically.
	for i, ev := range body.Events {
		if !IsPublic(ev.Kind) {
			httpx.Error(w, r, http.StatusBadRequest, "invalid_kind", "unknown kind: "+ev.Kind)
			return
		}
		if len(ev.Payload) > maxPayloadBytes {
			httpx.Error(w, r, http.StatusBadRequest, "payload_too_large", "event "+strconv.Itoa(i)+" payload exceeds 4 KiB")
			return
		}
	}

	// Identify actor: session_id from cookie auth → telegram_user_id; else anon header.
	var tgID int64
	var sessionID string
	if u, ok := auth.FromContext(r.Context()); ok && u.TelegramUserID > 0 {
		tgID = u.TelegramUserID
	} else {
		sessionID = strings.TrimSpace(r.Header.Get("X-Anon-Session"))
	}
	if tgID == 0 && sessionID == "" {
		// Tolerate missing identity — bucket all such requests by IP for rate limiting.
		sessionID = "ip:" + clientIP(r)
	}

	// Rate limit per (actor, kind).
	if h.RDB != nil {
		for _, ev := range body.Events {
			actor := strconv.FormatInt(tgID, 10)
			if tgID == 0 {
				actor = sessionID
			}
			if err := h.rateLimit(r.Context(), actor, ev.Kind); err != nil {
				httpx.Error(w, r, http.StatusTooManyRequests, "rate_limited", "too many events")
				return
			}
		}
	}

	ua := r.Header.Get("User-Agent")
	ip := clientIP(r)
	for _, ev := range body.Events {
		var payload any
		if len(ev.Payload) > 0 {
			payload = json.RawMessage(ev.Payload)
		}
		if err := h.Store.Record(r.Context(), RecordInput{
			Kind:           Kind(ev.Kind),
			TelegramUserID: tgID,
			SessionID:      sessionID,
			Payload:        payload,
			RequestIP:      ip,
			UserAgent:      ua,
		}); err != nil {
			httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// rateLimit enforces sliding-window: 20 / 10s AND 200 / 60s per (actor, kind).
func (h *Handler) rateLimit(ctx context.Context, actor, kind string) error {
	now := time.Now().UnixMilli()
	ctx, cancel := context.WithTimeout(ctx, 200*time.Millisecond)
	defer cancel()

	check := func(windowMs int64, limit int64, slot string) error {
		key := "events:rl:" + actor + ":" + kind + ":" + slot
		pipe := h.RDB.Pipeline()
		pipe.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: now})
		pipe.ZRemRangeByScore(ctx, key, "0", strconv.FormatInt(now-windowMs, 10))
		cardCmd := pipe.ZCard(ctx, key)
		pipe.Expire(ctx, key, time.Duration(windowMs)*time.Millisecond)
		if _, err := pipe.Exec(ctx); err != nil {
			return nil // graceful: fail-open on redis hiccup
		}
		if cardCmd.Val() > limit {
			return errors.New("rate_limited")
		}
		return nil
	}
	if err := check(10_000, rateWindow10s, "10s"); err != nil {
		return err
	}
	return check(60_000, rateWindowMinute, "60s")
}

// ===== Admin endpoints =====================================================

func (h *Handler) AdminList(w http.ResponseWriter, r *http.Request) {
	f, err := parseFilters(r)
	if err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_filters", err.Error())
		return
	}
	res, err := h.Store.List(r.Context(), f)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"items":      res.Items,
		"nextCursor": nilIfEmpty(res.NextCursor),
	})
}

func (h *Handler) AdminDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_id", "id must be integer")
		return
	}
	if err := h.Store.Delete(r.Context(), id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, r, http.StatusNotFound, "not_found", "event not found")
			return
		}
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) AdminBulkDelete(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("confirm") != "true" {
		httpx.Error(w, r, http.StatusBadRequest, "confirm_required", "must pass confirm=true")
		return
	}
	f, err := parseFilters(r)
	if err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_filters", err.Error())
		return
	}
	n, err := h.Store.BulkDelete(r.Context(), f)
	if err != nil {
		if errors.Is(err, ErrUnboundedDelete) {
			httpx.Error(w, r, http.StatusBadRequest, "unbounded_delete", "set ?to= upper bound")
			return
		}
		httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"deleted": n})
}

func parseFilters(r *http.Request) (ListFilters, error) {
	q := r.URL.Query()
	f := ListFilters{
		Q:      strings.TrimSpace(q.Get("q")),
		Cursor: q.Get("cursor"),
	}
	if v := q.Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return f, errors.New("from must be RFC3339")
		}
		f.From = &t
	}
	if v := q.Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return f, errors.New("to must be RFC3339")
		}
		f.To = &t
	}
	if kinds, ok := q["kind"]; ok {
		for _, k := range kinds {
			if !IsValid(k) {
				return f, errors.New("unknown kind: " + k)
			}
		}
		f.Kinds = kinds
	}
	if v := q.Get("telegramUserId"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return f, errors.New("telegramUserId must be integer")
		}
		f.TelegramUserID = &id
	}
	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			return f, errors.New("limit must be positive integer")
		}
		f.Limit = n
	}
	return f, nil
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i > 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	if xr := r.Header.Get("X-Real-Ip"); xr != "" {
		return xr
	}
	if i := strings.LastIndexByte(r.RemoteAddr, ':'); i > 0 {
		return r.RemoteAddr[:i]
	}
	return r.RemoteAddr
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// Ensure uuid import is referenced when other helpers expand later.
var _ = uuid.Nil
