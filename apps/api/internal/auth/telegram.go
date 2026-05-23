package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"
)

const initDataTTL = 24 * time.Hour

var (
	ErrInvalidInitData = errors.New("invalid initData signature")
	ErrInitDataExpired = errors.New("initData expired")
	ErrMissingUser     = errors.New("initData missing user payload")
)

type TelegramUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name,omitempty"`
	Username  string `json:"username,omitempty"`
	IsPremium bool   `json:"is_premium,omitempty"`
}

// VerifyInitData validates the Telegram Mini App initData payload.
// See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
func VerifyInitData(initData, botToken string, now time.Time) (TelegramUser, error) {
	if initData == "" || botToken == "" {
		return TelegramUser{}, ErrInvalidInitData
	}

	parsed, err := url.ParseQuery(initData)
	if err != nil {
		return TelegramUser{}, fmt.Errorf("parse initData: %w", ErrInvalidInitData)
	}

	hashHex := parsed.Get("hash")
	if hashHex == "" {
		return TelegramUser{}, ErrInvalidInitData
	}
	parsed.Del("hash")

	keys := make([]string, 0, len(parsed))
	for k := range parsed {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var sb strings.Builder
	for i, k := range keys {
		if i > 0 {
			sb.WriteByte('\n')
		}
		sb.WriteString(k)
		sb.WriteByte('=')
		sb.WriteString(parsed.Get(k))
	}

	secretKey := hmacSHA256([]byte("WebAppData"), []byte(botToken))
	expected := hmacSHA256(secretKey, []byte(sb.String()))
	if !hmac.Equal([]byte(hex.EncodeToString(expected)), []byte(hashHex)) {
		return TelegramUser{}, ErrInvalidInitData
	}

	if authDateStr := parsed.Get("auth_date"); authDateStr != "" {
		ts, err := parseUnix(authDateStr)
		if err != nil {
			return TelegramUser{}, fmt.Errorf("parse auth_date: %w", ErrInvalidInitData)
		}
		if now.Sub(ts) > initDataTTL {
			return TelegramUser{}, ErrInitDataExpired
		}
	}

	userJSON := parsed.Get("user")
	if userJSON == "" {
		return TelegramUser{}, ErrMissingUser
	}
	var user TelegramUser
	if err := json.Unmarshal([]byte(userJSON), &user); err != nil {
		return TelegramUser{}, fmt.Errorf("parse user: %w", ErrInvalidInitData)
	}
	if user.ID == 0 {
		return TelegramUser{}, ErrMissingUser
	}
	return user, nil
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func parseUnix(s string) (time.Time, error) {
	var n int64
	for _, c := range s {
		if c < '0' || c > '9' {
			return time.Time{}, errors.New("non-numeric auth_date")
		}
		n = n*10 + int64(c-'0')
	}
	return time.Unix(n, 0).UTC(), nil
}
