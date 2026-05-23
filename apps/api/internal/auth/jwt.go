package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type SessionClaims struct {
	TelegramUserID int64  `json:"sub_tg"`
	IsAdmin        bool   `json:"adm"`
	FirstName      string `json:"fn,omitempty"`
	Username       string `json:"un,omitempty"`
	jwt.RegisteredClaims
}

type JWTIssuer struct {
	secret []byte
	ttl    time.Duration
}

func NewJWTIssuer(secret string, ttl time.Duration) *JWTIssuer {
	return &JWTIssuer{secret: []byte(secret), ttl: ttl}
}

func (j *JWTIssuer) Issue(tgUserID int64, isAdmin bool, firstName, username string) (string, time.Time, error) {
	now := time.Now().UTC()
	exp := now.Add(j.ttl)
	claims := SessionClaims{
		TelegramUserID: tgUserID,
		IsAdmin:        isAdmin,
		FirstName:      firstName,
		Username:       username,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   fmt.Sprintf("tg:%d", tgUserID),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			NotBefore: jwt.NewNumericDate(now),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(j.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign jwt: %w", err)
	}
	return signed, exp, nil
}

func (j *JWTIssuer) Parse(raw string) (*SessionClaims, error) {
	claims := &SessionClaims{}
	tok, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return j.secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !tok.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
