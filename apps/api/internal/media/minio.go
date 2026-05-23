package media

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var allowedMimes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type Service struct {
	client       *minio.Client
	bucket       string
	publicURL    string
	maxSizeBytes int64
	urlTTL       time.Duration
}

type Config struct {
	Endpoint     string
	AccessKey    string
	SecretKey    string
	UseSSL       bool
	Bucket       string
	PublicURL    string
	MaxSizeBytes int64
	URLTTL       time.Duration
}

func New(cfg Config) (*Service, error) {
	cli, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio client: %w", err)
	}
	return &Service{
		client:       cli,
		bucket:       cfg.Bucket,
		publicURL:    cfg.PublicURL,
		maxSizeBytes: cfg.MaxSizeBytes,
		urlTTL:       cfg.URLTTL,
	}, nil
}

func (s *Service) EnsureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("bucket exists: %w", err)
	}
	if exists {
		return nil
	}
	return s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{})
}

func (s *Service) Ping(ctx context.Context) error {
	_, err := s.client.BucketExists(ctx, s.bucket)
	return err
}

type SignUploadParams struct {
	ClubID   uuid.UUID
	Filename string
	Mime     string
	Size     int64
}

type SignedUpload struct {
	URL       string    `json:"url"`
	Key       string    `json:"key"`
	ExpiresAt time.Time `json:"expiresAt"`
}

var (
	ErrUnsupportedMime = errors.New("unsupported_media_type")
	ErrTooLarge        = errors.New("file_too_large")
)

func (s *Service) SignUpload(ctx context.Context, p SignUploadParams) (SignedUpload, error) {
	ext, ok := allowedMimes[strings.ToLower(p.Mime)]
	if !ok {
		return SignedUpload{}, ErrUnsupportedMime
	}
	if p.Size <= 0 || p.Size > s.maxSizeBytes {
		return SignedUpload{}, ErrTooLarge
	}
	id := uuid.New()
	key := path.Join("clubs", p.ClubID.String(), id.String()+ext)
	expiry := s.urlTTL
	u, err := s.client.PresignedPutObject(ctx, s.bucket, key, expiry)
	if err != nil {
		return SignedUpload{}, fmt.Errorf("presign put: %w", err)
	}
	return SignedUpload{
		URL:       rewriteToPublic(u, s.publicURL),
		Key:       key,
		ExpiresAt: time.Now().UTC().Add(expiry),
	}, nil
}

func (s *Service) PresignedGet(ctx context.Context, key string) (string, error) {
	u, err := s.client.PresignedGetObject(ctx, s.bucket, key, s.urlTTL, url.Values{})
	if err != nil {
		return "", err
	}
	return rewriteToPublic(u, s.publicURL), nil
}

func rewriteToPublic(u *url.URL, publicURL string) string {
	if publicURL == "" {
		return u.String()
	}
	parsed, err := url.Parse(publicURL)
	if err != nil || parsed.Host == "" {
		return u.String()
	}
	u.Host = parsed.Host
	u.Scheme = parsed.Scheme
	return u.String()
}
