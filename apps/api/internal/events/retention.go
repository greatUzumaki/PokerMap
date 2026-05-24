package events

import (
	"context"
	"log/slog"
	"time"
)

// RunRetentionLoop blocks until ctx is cancelled. retentionDays must be > 0.
func RunRetentionLoop(ctx context.Context, store *Store, retentionDays int, initialDelay time.Duration, logger *slog.Logger) {
	if retentionDays <= 0 {
		logger.Error("events retention loop refusing to start", "retentionDays", retentionDays)
		return
	}
	timer := time.NewTimer(initialDelay)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			cutoff := time.Now().UTC().Add(-time.Duration(retentionDays) * 24 * time.Hour)
			pctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
			n, err := store.Prune(pctx, cutoff, 10_000)
			cancel()
			if err != nil {
				logger.Warn("events.prune", "err", err, "cutoff", cutoff)
			} else {
				logger.Info("events.prune", "deleted", n, "cutoff", cutoff)
			}
			timer.Reset(24 * time.Hour)
		}
	}
}
