// Package bot handles incoming Telegram bot updates via webhook.
package bot

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/pokermap/api/internal/events"
	"github.com/pokermap/api/internal/users"
)

const apiBase = "https://api.telegram.org/bot"

type Update struct {
	UpdateID int64    `json:"update_id"`
	Message  *Message `json:"message,omitempty"`
}

type Message struct {
	MessageID int64  `json:"message_id"`
	Text      string `json:"text"`
	Chat      Chat   `json:"chat"`
	From      *User  `json:"from"`
}

type Chat struct {
	ID int64 `json:"id"`
}

type User struct {
	ID              int64  `json:"id"`
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name,omitempty"`
	Username        string `json:"username,omitempty"`
	LanguageCode    string `json:"language_code,omitempty"`
	IsPremium       bool   `json:"is_premium,omitempty"`
	IsBot           bool   `json:"is_bot,omitempty"`
	AllowsWriteToPM *bool  `json:"allows_write_to_pm,omitempty"`
}

type Handler struct {
	BotToken      string
	WebhookSecret string
	MiniAppURL    string
	Users         *users.Store
	Events        *events.Store
	Logger        *slog.Logger
	HTTPClient    *http.Client
}

func NewHandler(token, secret, miniAppURL string, u *users.Store, e *events.Store, logger *slog.Logger) *Handler {
	return &Handler{
		BotToken:      token,
		WebhookSecret: secret,
		MiniAppURL:    miniAppURL,
		Users:         u,
		Events:        e,
		Logger:        logger,
		HTTPClient:    &http.Client{Timeout: 5 * time.Second},
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if h.BotToken == "" || strings.Contains(h.BotToken, "REPLACE_ME") {
		http.Error(w, "bot disabled", http.StatusServiceUnavailable)
		return
	}
	got := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
	if h.WebhookSecret == "" ||
		subtle.ConstantTimeCompare([]byte(got), []byte(h.WebhookSecret)) != 1 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var upd Update
	if err := json.Unmarshal(body, &upd); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}

	if upd.Message != nil && upd.Message.From != nil {
		if err := h.handleMessage(r.Context(), upd); err != nil {
			h.Logger.Warn("bot: handleMessage", "err", err, "update_id", upd.UpdateID)
		}
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) handleMessage(ctx context.Context, upd Update) error {
	m := upd.Message
	if m == nil || m.From == nil {
		return nil
	}

	// Upsert every sender, not just /start, so user-tracking captures every interaction.
	usernamePtr := stringPtrOrNil(m.From.Username)
	languagePtr := stringPtrOrNil(m.From.LanguageCode)
	if err := h.Users.Upsert(ctx, users.UpsertInput{
		TelegramUserID:  m.From.ID,
		FirstName:       m.From.FirstName,
		LastName:        m.From.LastName,
		Username:        usernamePtr,
		LanguageCode:    languagePtr,
		IsPremium:       m.From.IsPremium,
		IsBot:           m.From.IsBot,
		AllowsWriteToPM: m.From.AllowsWriteToPM,
	}); err != nil {
		return fmt.Errorf("upsert user: %w", err)
	}

	text := strings.TrimSpace(m.Text)
	if !strings.HasPrefix(text, "/start") {
		return nil
	}
	startParam := strings.TrimSpace(strings.TrimPrefix(text, "/start"))

	if err := h.Events.Record(ctx, events.RecordInput{
		Kind:           events.KindBotStart,
		TelegramUserID: m.From.ID,
		Payload: map[string]any{
			"chat_id":    m.Chat.ID,
			"update_id":  upd.UpdateID,
			"start_param": startParam,
		},
	}); err != nil {
		return fmt.Errorf("record event: %w", err)
	}

	return h.sendWelcome(ctx, m.Chat.ID, m.From.FirstName)
}

func (h *Handler) sendWelcome(ctx context.Context, chatID int64, firstName string) error {
	greeting := firstName
	if greeting == "" {
		greeting = "друг"
	}
	body := map[string]any{
		"chat_id": chatID,
		"text":    "Привет, " + greeting + "! 🃏\nЯ помогу найти живые покер-клубы Петербурга.",
		"reply_markup": map[string]any{
			"inline_keyboard": [][]map[string]any{
				{
					{
						"text":    "Открыть карту",
						"web_app": map[string]string{"url": h.MiniAppURL},
					},
				},
			},
		},
	}
	return h.callAPI(ctx, "sendMessage", body)
}

func (h *Handler) callAPI(ctx context.Context, method string, body any) error {
	buf, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBase+h.BotToken+"/"+method, bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := h.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("telegram %s: %s: %s", method, resp.Status, string(b))
	}
	return nil
}

// EnsureWebhook is idempotent: no-op when Telegram already has webhookURL registered.
func EnsureWebhook(ctx context.Context, botToken, webhookURL, secret string, logger *slog.Logger) error {
	if botToken == "" || strings.Contains(botToken, "REPLACE_ME") || webhookURL == "" {
		logger.Info("bot webhook not configured (missing token or url) — skipping")
		return nil
	}
	client := &http.Client{Timeout: 5 * time.Second}

	info, err := callGet(ctx, client, botToken, "getWebhookInfo")
	if err != nil {
		return fmt.Errorf("getWebhookInfo: %w", err)
	}
	var infoBody struct {
		Result struct {
			URL string `json:"url"`
		} `json:"result"`
	}
	if err := json.Unmarshal(info, &infoBody); err != nil {
		return fmt.Errorf("parse getWebhookInfo: %w", err)
	}
	if infoBody.Result.URL == webhookURL {
		logger.Info("bot webhook already registered", "url", webhookURL)
		return nil
	}

	logger.Info("bot webhook updating", "old", infoBody.Result.URL, "new", webhookURL)
	body := map[string]any{
		"url":                  webhookURL,
		"secret_token":         secret,
		"drop_pending_updates": true,
		"allowed_updates":      []string{"message"},
	}
	buf, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBase+botToken+"/setWebhook", bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return errors.New("setWebhook failed: " + string(b))
	}
	logger.Info("bot webhook updated", "url", webhookURL)
	return nil
}

func callGet(ctx context.Context, c *http.Client, token, method string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiBase+token+"/"+method, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(io.LimitReader(resp.Body, 1<<20))
}

func stringPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
