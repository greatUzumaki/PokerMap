package events

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUnboundedDelete = errors.New("bulk delete requires an upper time bound")

type Event struct {
	ID             int64           `json:"id"`
	OccurredAt     time.Time       `json:"occurredAt"`
	TelegramUserID *int64          `json:"telegramUserId"`
	SessionID      *string         `json:"sessionId"`
	Kind           string          `json:"kind"`
	EntityType     *string         `json:"entityType"`
	EntityID       *uuid.UUID      `json:"entityId"`
	Payload        json.RawMessage `json:"payload"`
	RequestIP      *string         `json:"requestIp"`
	UserAgent      *string         `json:"userAgent"`
	ActorFirstName *string         `json:"actorFirstName,omitempty"`
	ActorLastName  *string `json:"actorLastName,omitempty"`
	ActorUsername  *string `json:"actorUsername,omitempty"`
}

// RecordInput: zero-valued TelegramUserID, SessionID, EntityType,
// EntityID, RequestIP, and UserAgent become SQL NULL. nil Payload → '{}'.
type RecordInput struct {
	Kind           Kind
	TelegramUserID int64
	SessionID      string
	EntityType     string
	EntityID       uuid.UUID
	Payload        any
	RequestIP      string
	UserAgent      string
}

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Record(ctx context.Context, in RecordInput) error {
	if in.Kind == "" {
		return fmt.Errorf("events.Record: kind is required")
	}
	var payloadBytes []byte
	if in.Payload != nil {
		b, err := json.Marshal(in.Payload)
		if err != nil {
			return fmt.Errorf("marshal payload: %w", err)
		}
		payloadBytes = b
	} else {
		payloadBytes = []byte("{}")
	}

	var (
		tgUserID interface{}
		sessID   interface{}
		eType    interface{}
		eID      interface{}
		ip       interface{}
		ua       interface{}
	)
	if in.TelegramUserID > 0 {
		tgUserID = in.TelegramUserID
	}
	if in.SessionID != "" {
		sessID = in.SessionID
	}
	if in.EntityType != "" {
		eType = in.EntityType
	}
	if in.EntityID != uuid.Nil {
		eID = in.EntityID
	}
	if in.RequestIP != "" {
		ip = in.RequestIP
	}
	if in.UserAgent != "" {
		ua = in.UserAgent
	}

	_, err := s.pool.Exec(ctx, `
		INSERT INTO user_events (
			telegram_user_id, session_id, kind, entity_type, entity_id,
			payload, request_ip, user_agent
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, tgUserID, sessID, string(in.Kind), eType, eID, payloadBytes, ip, ua)
	return err
}

type ListFilters struct {
	From            *time.Time
	To              *time.Time
	Kinds           []string
	TelegramUserID  *int64
	Q               string
	Cursor          string
	Limit           int
}

type cursorTuple struct {
	OccurredAt time.Time
	ID         int64
}

func encodeCursor(c cursorTuple) string {
	return fmt.Sprintf("%d_%d", c.OccurredAt.UnixNano(), c.ID)
}

func decodeCursor(s string) (cursorTuple, bool) {
	if s == "" {
		return cursorTuple{}, false
	}
	parts := strings.SplitN(s, "_", 2)
	if len(parts) != 2 {
		return cursorTuple{}, false
	}
	ns, err1 := strconv.ParseInt(parts[0], 10, 64)
	id, err2 := strconv.ParseInt(parts[1], 10, 64)
	if err1 != nil || err2 != nil {
		return cursorTuple{}, false
	}
	return cursorTuple{OccurredAt: time.Unix(0, ns), ID: id}, true
}

type ListResult struct {
	Items      []Event
	NextCursor string
}

func (s *Store) List(ctx context.Context, f ListFilters) (ListResult, error) {
	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	args := []any{}
	clauses := []string{"1=1"}

	if f.From != nil {
		args = append(args, *f.From)
		clauses = append(clauses, fmt.Sprintf("e.occurred_at >= $%d", len(args)))
	}
	if f.To != nil {
		args = append(args, *f.To)
		clauses = append(clauses, fmt.Sprintf("e.occurred_at < $%d", len(args)))
	}
	if len(f.Kinds) > 0 {
		args = append(args, f.Kinds)
		clauses = append(clauses, fmt.Sprintf("e.kind = ANY($%d)", len(args)))
	}
	if f.TelegramUserID != nil {
		args = append(args, *f.TelegramUserID)
		clauses = append(clauses, fmt.Sprintf("e.telegram_user_id = $%d", len(args)))
	}
	if f.Q != "" {
		args = append(args, "%"+f.Q+"%")
		clauses = append(clauses, fmt.Sprintf("e.payload::text ILIKE $%d", len(args)))
	}
	if c, ok := decodeCursor(f.Cursor); ok {
		args = append(args, c.OccurredAt, c.ID)
		clauses = append(clauses,
			fmt.Sprintf("(e.occurred_at, e.id) < ($%d, $%d)", len(args)-1, len(args)),
		)
	}

	args = append(args, limit+1)
	limitPlaceholder := fmt.Sprintf("$%d", len(args))

	sql := `
		SELECT e.id, e.occurred_at, e.telegram_user_id, e.session_id, e.kind,
		       e.entity_type, e.entity_id, e.payload, e.request_ip::text, e.user_agent,
		       u.first_name, u.last_name, u.username
		FROM user_events e
		LEFT JOIN users u ON u.telegram_user_id = e.telegram_user_id
		WHERE ` + strings.Join(clauses, " AND ") + `
		ORDER BY e.occurred_at DESC, e.id DESC
		LIMIT ` + limitPlaceholder

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return ListResult{}, err
	}
	defer rows.Close()

	items := make([]Event, 0, limit)
	for rows.Next() {
		var ev Event
		var entityID *uuid.UUID
		if err := rows.Scan(
			&ev.ID, &ev.OccurredAt, &ev.TelegramUserID, &ev.SessionID, &ev.Kind,
			&ev.EntityType, &entityID, &ev.Payload, &ev.RequestIP, &ev.UserAgent,
			&ev.ActorFirstName, &ev.ActorLastName, &ev.ActorUsername,
		); err != nil {
			return ListResult{}, err
		}
		ev.EntityID = entityID
		items = append(items, ev)
	}
	if err := rows.Err(); err != nil {
		return ListResult{}, err
	}

	var nextCursor string
	if len(items) > limit {
		last := items[limit-1]
		nextCursor = encodeCursor(cursorTuple{OccurredAt: last.OccurredAt, ID: last.ID})
		items = items[:limit]
	}
	return ListResult{Items: items, NextCursor: nextCursor}, nil
}

func (s *Store) Delete(ctx context.Context, id int64) error {
	ct, err := s.pool.Exec(ctx, `DELETE FROM user_events WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) BulkDelete(ctx context.Context, f ListFilters) (int64, error) {
	if f.To == nil {
		return 0, ErrUnboundedDelete
	}
	args := []any{}
	clauses := []string{}
	args = append(args, *f.To)
	clauses = append(clauses, fmt.Sprintf("occurred_at < $%d", len(args)))
	if f.From != nil {
		args = append(args, *f.From)
		clauses = append(clauses, fmt.Sprintf("occurred_at >= $%d", len(args)))
	}
	if len(f.Kinds) > 0 {
		args = append(args, f.Kinds)
		clauses = append(clauses, fmt.Sprintf("kind = ANY($%d)", len(args)))
	}
	if f.TelegramUserID != nil {
		args = append(args, *f.TelegramUserID)
		clauses = append(clauses, fmt.Sprintf("telegram_user_id = $%d", len(args)))
	}
	if f.Q != "" {
		args = append(args, "%"+f.Q+"%")
		clauses = append(clauses, fmt.Sprintf("payload::text ILIKE $%d", len(args)))
	}
	sql := `DELETE FROM user_events WHERE ` + strings.Join(clauses, " AND ")
	ct, err := s.pool.Exec(ctx, sql, args...)
	if err != nil {
		return 0, err
	}
	return ct.RowsAffected(), nil
}

func (s *Store) Prune(ctx context.Context, olderThan time.Time, batchSize int) (int64, error) {
	if batchSize <= 0 {
		batchSize = 10_000
	}
	var total int64
	for {
		ct, err := s.pool.Exec(ctx, `
			DELETE FROM user_events
			WHERE id IN (
				SELECT id FROM user_events WHERE occurred_at < $1 LIMIT $2
			)
		`, olderThan, batchSize)
		if err != nil {
			return total, err
		}
		n := ct.RowsAffected()
		total += n
		if n < int64(batchSize) {
			return total, nil
		}
	}
}
