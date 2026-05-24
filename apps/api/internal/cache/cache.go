// Package cache wraps go-redis for a small read-through caching layer.
// When REDIS_URL is empty, NewNoop returns a no-op cache so the rest of
// the code does not need to special-case the unconfigured path.
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
	Invalidate(ctx context.Context, patterns ...string) error
	Ping(ctx context.Context) error
	Enabled() bool
	Close() error
	// Raw exposes the underlying redis client for callers that need direct
	// access (rate limiters, distributed locks). Returns nil for the no-op cache.
	Raw() *redis.Client
}

type redisCache struct {
	rdb    *redis.Client
	prefix string
	logger *slog.Logger
}

type noopCache struct{}

func New(url, prefix string, logger *slog.Logger) (Cache, error) {
	if url == "" {
		logger.Info("cache disabled (REDIS_URL empty)")
		return NewNoop(), nil
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse REDIS_URL: %w", err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		_ = rdb.Close()
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	logger.Info("cache enabled", "addr", opt.Addr, "prefix", prefix)
	return &redisCache{rdb: rdb, prefix: prefix, logger: logger}, nil
}

func NewNoop() Cache { return noopCache{} }

func (c *redisCache) key(k string) string { return c.prefix + k }

func (c *redisCache) Enabled() bool { return true }

func (c *redisCache) Get(ctx context.Context, key string, dst any) (bool, error) {
	raw, err := c.rdb.Get(ctx, c.key(key)).Bytes()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := json.Unmarshal(raw, dst); err != nil {
		// Bad cache entry — evict and miss.
		_ = c.rdb.Del(ctx, c.key(key)).Err()
		return false, nil
	}
	return true, nil
}

func (c *redisCache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if ttl <= 0 {
		ttl = time.Minute
	}
	return c.rdb.Set(ctx, c.key(key), raw, ttl).Err()
}

// Invalidate deletes every key whose name matches one of the given patterns
// (after the prefix is applied). Uses SCAN to avoid blocking the server.
func (c *redisCache) Invalidate(ctx context.Context, patterns ...string) error {
	if len(patterns) == 0 {
		return nil
	}
	for _, pat := range patterns {
		full := c.key(pat)
		iter := c.rdb.Scan(ctx, 0, full, 200).Iterator()
		batch := make([]string, 0, 64)
		flush := func() error {
			if len(batch) == 0 {
				return nil
			}
			if err := c.rdb.Del(ctx, batch...).Err(); err != nil {
				return err
			}
			batch = batch[:0]
			return nil
		}
		for iter.Next(ctx) {
			batch = append(batch, iter.Val())
			if len(batch) >= 200 {
				if err := flush(); err != nil {
					return err
				}
			}
		}
		if err := iter.Err(); err != nil {
			return err
		}
		if err := flush(); err != nil {
			return err
		}
	}
	return nil
}

func (c *redisCache) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

func (c *redisCache) Close() error {
	return c.rdb.Close()
}

func (c *redisCache) Raw() *redis.Client { return c.rdb }

func (noopCache) Get(context.Context, string, any) (bool, error)              { return false, nil }
func (noopCache) Set(context.Context, string, any, time.Duration) error        { return nil }
func (noopCache) Invalidate(context.Context, ...string) error                  { return nil }
func (noopCache) Ping(context.Context) error                                   { return nil }
func (noopCache) Enabled() bool                                                { return false }
func (noopCache) Close() error                                                 { return nil }
func (noopCache) Raw() *redis.Client                                            { return nil }
