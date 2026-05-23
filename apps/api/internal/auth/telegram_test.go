package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"testing"
	"time"
)

const testBotToken = "1234567890:TEST_TOKEN"

func signedInitData(t *testing.T, authDate int64, userJSON string) string {
	t.Helper()
	v := url.Values{}
	v.Set("auth_date", fmt.Sprintf("%d", authDate))
	v.Set("query_id", "AAH-test")
	v.Set("user", userJSON)

	keys := make([]string, 0, len(v))
	for k := range v {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var sb strings.Builder
	for i, k := range keys {
		if i > 0 {
			sb.WriteByte('\n')
		}
		sb.WriteString(k + "=" + v.Get(k))
	}
	sec := hmac.New(sha256.New, []byte("WebAppData"))
	sec.Write([]byte(testBotToken))
	mac := hmac.New(sha256.New, sec.Sum(nil))
	mac.Write([]byte(sb.String()))
	v.Set("hash", hex.EncodeToString(mac.Sum(nil)))
	return v.Encode()
}

func TestVerifyInitData_Valid(t *testing.T) {
	now := time.Now().UTC()
	data := signedInitData(t, now.Unix(), `{"id":42,"first_name":"Alex","username":"alex"}`)
	u, err := VerifyInitData(data, testBotToken, now)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if u.ID != 42 || u.FirstName != "Alex" {
		t.Fatalf("bad user %+v", u)
	}
}

func TestVerifyInitData_TamperedHash(t *testing.T) {
	now := time.Now().UTC()
	data := signedInitData(t, now.Unix(), `{"id":42,"first_name":"Alex"}`)
	tampered := data + "x"
	if _, err := VerifyInitData(tampered, testBotToken, now); err == nil {
		t.Fatal("expected error")
	}
}

func TestVerifyInitData_Expired(t *testing.T) {
	now := time.Now().UTC()
	oldUnix := now.Add(-48 * time.Hour).Unix()
	data := signedInitData(t, oldUnix, `{"id":42,"first_name":"Alex"}`)
	_, err := VerifyInitData(data, testBotToken, now)
	if err != ErrInitDataExpired {
		t.Fatalf("expected expired, got %v", err)
	}
}
