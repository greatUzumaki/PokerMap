package config

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/kelseyhightower/envconfig"
)

const (
	placeholderToken  = "REPLACE_ME"
	placeholderSecret = "REPLACE_ME_WITH_32_PLUS_RANDOM_BYTES"
)

type Config struct {
	HTTPAddr             string        `envconfig:"HTTP_ADDR" default:":8080"`
	Env                  string        `envconfig:"ENV" default:"development"`
	LogLevel             string        `envconfig:"LOG_LEVEL" default:"info"`
	CORSAllowedOrigins   []string      `envconfig:"CORS_ALLOWED_ORIGINS" default:"http://localhost:3000"`
	DatabaseURL          string        `envconfig:"DATABASE_URL" required:"true"`
	DatabaseMaxConns     int32         `envconfig:"DATABASE_MAX_CONNS" default:"10"`
	MinioEndpoint        string        `envconfig:"MINIO_ENDPOINT" required:"true"`
	MinioUseSSL          bool          `envconfig:"MINIO_USE_SSL" default:"false"`
	MinioAccessKey       string        `envconfig:"MINIO_ACCESS_KEY" required:"true"`
	MinioSecretKey       string        `envconfig:"MINIO_SECRET_KEY" required:"true"`
	MinioBucket          string        `envconfig:"MINIO_BUCKET" default:"pokermap-photos"`
	MinioPublicURL       string        `envconfig:"MINIO_PUBLIC_URL" default:"http://localhost:9000"`
	TelegramBotToken     string        `envconfig:"TELEGRAM_BOT_TOKEN" required:"true"`
	JWTSecret            string        `envconfig:"JWT_SECRET" required:"true"`
	JWTTTL               time.Duration `envconfig:"JWT_TTL" default:"168h"`
	AdminTelegramIDs     []int64       `envconfig:"ADMIN_TELEGRAM_IDS"`
	UploadMaxSizeBytes   int64         `envconfig:"UPLOAD_MAX_SIZE_BYTES" default:"8388608"`
	UploadURLTTL         time.Duration `envconfig:"UPLOAD_URL_TTL" default:"5m"`
	RedisURL             string        `envconfig:"REDIS_URL"`
	CacheTTL             time.Duration `envconfig:"CACHE_TTL" default:"60s"`
	CacheKeyPrefix       string        `envconfig:"CACHE_KEY_PREFIX" default:"pm:"`
	SuperadminUsername   string        `envconfig:"SUPERADMIN_USERNAME" default:"admin"`
	SuperadminPassword   string        `envconfig:"SUPERADMIN_PASSWORD"`
}

func (c Config) IsProduction() bool {
	return strings.EqualFold(c.Env, "production") || strings.EqualFold(c.Env, "prod")
}

func (c Config) HasPlaceholderSecrets() (warnings []string) {
	if strings.Contains(c.TelegramBotToken, placeholderToken) {
		warnings = append(warnings, "TELEGRAM_BOT_TOKEN is a placeholder — auth endpoints will degrade")
	}
	if strings.Contains(c.JWTSecret, placeholderSecret) {
		warnings = append(warnings, "JWT_SECRET is a placeholder — auth endpoints will degrade")
	}
	return warnings
}

func Load() (Config, error) {
	// Best-effort: load .env if present. Ignore missing file.
	_ = godotenv.Load()

	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return Config{}, fmt.Errorf("loading config: %w", err)
	}
	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) validate() error {
	if c.IsProduction() {
		if warns := c.HasPlaceholderSecrets(); len(warns) > 0 {
			return errors.New("production env contains placeholder secrets: " + strings.Join(warns, "; "))
		}
		if len(c.JWTSecret) < 32 {
			return errors.New("JWT_SECRET must be at least 32 bytes in production")
		}
	}
	return nil
}

func (c Config) LogWarnings(logger *slog.Logger) {
	for _, w := range c.HasPlaceholderSecrets() {
		logger.Warn("config placeholder detected", "issue", w)
	}
}
