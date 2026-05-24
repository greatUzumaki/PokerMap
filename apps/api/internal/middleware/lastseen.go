package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/pokermap/api/internal/auth"
	"github.com/redis/go-redis/v9"
)

type lastSeenStore interface {
	MarkSeen(ctx context.Context, telegramUserID int64) error
}

// LastSeen bumps users.last_seen_at at most once per 60s per user via Redis.
// Skips silently when Redis is nil or errors, so request traffic is never blocked.
func LastSeen(rdb *redis.Client, store lastSeenStore, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer next.ServeHTTP(w, r)
			u, ok := auth.FromContext(r.Context())
			if !ok || u.TelegramUserID <= 0 {
				return
			}
			if rdb != nil {
				ctx, cancel := context.WithTimeout(r.Context(), 150*time.Millisecond)
				defer cancel()
				key := "last_seen:" + itoa(u.TelegramUserID)
				ok, err := rdb.SetNX(ctx, key, "1", 60*time.Second).Result()
				if err != nil {
					if logger != nil {
						logger.Debug("lastseen redis err", "err", err)
					}
					return
				}
				if !ok {
					return
				}
			}
			ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
			defer cancel()
			if err := store.MarkSeen(ctx, u.TelegramUserID); err != nil && logger != nil {
				logger.Debug("lastseen db err", "err", err)
			}
		})
	}
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
