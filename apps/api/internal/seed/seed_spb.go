// Package seed ships a curated catalog of Saint Petersburg sport-poker clubs.
//
// Inclusion criteria (any seeded venue MUST satisfy all):
//   - Legal sport-poker format (rating-only, no monetary prizes, no rake).
//   - Fixed organisational fee (`entry_fee_cents`) ≤ 1500 ₽.
//   - Verified address or, if location rotates, a public Telegram channel
//     where each event's venue is announced.
//   - Active in the last 30 days (verify Telegram or Instagram posts).
//
// Cash venues, PPPoker-based clubs, and anything advertising buy-ins or rake
// MUST NOT be added — the public catalog stays clean of grey-zone operators.
// When a venue closes or changes format, its slug moves into
// `legacyDemoSlugs` so the seeder deletes it on the next run.
package seed

import (
	"encoding/json"

	"github.com/pokermap/api/internal/clubs"
	"github.com/pokermap/api/internal/db"
)

// legacyDemoSlugs lists every slug that must be deleted by every Run, ahead
// of the upsert pass. It carries:
//   - the original Demo seeder rows (`royal-poker-club`, etc.), and
//   - cash-game venues retired in 2026-05 when the catalog was narrowed to
//     sport-poker-only.
var legacyDemoSlugs = []string{
	"royal-poker-club",
	"neva-cardroom",
	"petrogradka-poker",
	"moskovsky-poker",
	"vasilevsky-card",
	"kupchino-poker",
	"bluff",
	"pulse",
	"elo-club",
	"obriens-poker",
	"cromulent-club",
}

func everyDayHours(open, close string) clubs.WorkingHours {
	d := clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: open, Close: close}}}
	return clubs.WorkingHours{Mon: d, Tue: d, Wed: d, Thu: d, Fri: d, Sat: d, Sun: d}
}

func ptrI64(v int64) *int64 { return &v }
func ptrS(v string) *string { return &v }

func mustJSON(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

var spbClubs = []db.CreateClubParams{
	// source: https://yandex.com/maps/org/badbeat/78255914436/ + https://www.instagram.com/bad_beat_pokerclub/, checked: 2026-05-24
	{
		Slug:    "bad-beat",
		Name:    "Bad Beat",
		Address: "Санкт-Петербург, 8-я Советская ул., 4, 2 этаж",
		Lat:     59.9389,
		Lng:     30.3793,
		Description: "Покерный клуб не на деньги в центре Петербурга. Турниры с фиксированным оргвзносом, " +
			"рейтинговая система, без призовых. Регистрация — через Telegram-канал клуба.",
		Phones:          []string{"+7 (903) 431-33-33"},
		TelegramURL:     ptrS("https://t.me/bad_beat_club"),
		WorkingHours:    mustJSON(everyDayHours("19:00", "02:00")),
		Games:           []string{"NLH", "MTT"},
		MinBuyInCents:   nil,
		MaxBuyInCents:   nil,
		EntryFeeCents:   ptrI64(100000),
		RakeDescription: "",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMTTSeries),
		SocialLinks: mustJSON(clubs.SocialLinks{
			TelegramChannel: "https://t.me/bad_beat_club",
			Instagram:       "https://www.instagram.com/bad_beat_pokerclub/",
		}),
		Status: db.ClubStatusPublished,
	},

	// source: https://raiseclubspb.ru/, checked: 2026-05-24
	{
		Slug:    "raise-club",
		Name:    "Raise Club",
		Address: "Санкт-Петербург, Кожевенная линия, 30, лофт Brosko (Севкабель Порт)",
		Lat:     59.9264,
		Lng:     30.2491,
		Description: "Сообщество спортивного покера. Турниры ежедневно с 19:00. " +
			"Рейтинговая система, без денежных ставок и призов.",
		Phones:          []string{},
		Website:         ptrS("https://raiseclubspb.ru/"),
		WorkingHours:    mustJSON(everyDayHours("19:00", "02:00")),
		Games:           []string{"NLH", "MTT"},
		MinBuyInCents:   nil,
		MaxBuyInCents:   nil,
		EntryFeeCents:   ptrI64(100000),
		RakeDescription: "",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMTTSeries),
		SocialLinks:     mustJSON(clubs.SocialLinks{}),
		Status:          db.ClubStatusPublished,
	},

	// source: https://spb-poker-club.ru/ + https://t.me/spb_poker_club, checked: 2026-05-24
	{
		Slug:    "spb-poker-club",
		Name:    "SPB Poker Club",
		Address: "Санкт-Петербург, ул. Арсенальная, 2 (Лофт План Б)",
		Lat:     59.9577,
		Lng:     30.3691,
		Description: "Спортивный покер не на деньги в Лофт План Б. Регулярные турниры: Nit Stack для новичков, " +
			"классический Boom Pot, нокаут-турнир Mystery. Оргвзнос 1000 ₽. Регистрация — в TG-канале.",
		Phones:          []string{},
		Website:         ptrS("https://spb-poker-club.ru/"),
		TelegramURL:     ptrS("https://t.me/spb_poker_club"),
		WorkingHours:    mustJSON(everyDayHours("19:00", "02:00")),
		Games:           []string{"NLH", "MTT"},
		MinBuyInCents:   nil,
		MaxBuyInCents:   nil,
		EntryFeeCents:   ptrI64(100000),
		RakeDescription: "",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMTTSeries),
		SocialLinks: mustJSON(clubs.SocialLinks{
			TelegramChannel: "https://t.me/spb_poker_club",
		}),
		Status: db.ClubStatusPublished,
	},

	// source: https://t.me/overbetspb + https://www.instagram.com/pokerspb_club/, checked: 2026-05-24
	// Draft until a stable physical venue is published — events rotate, booked via TG.
	{
		Slug:    "overbet-club",
		Name:    "Overbet Club",
		Address: "Санкт-Петербург (локация уточняется через TG-канал)",
		Lat:     59.9343,
		Lng:     30.3351,
		Description: "Покер не на деньги. Турниры ежедневно, рейтинговая система. " +
			"Адрес проведения и регистрация — через Telegram-канал.",
		Phones:          []string{},
		TelegramURL:     ptrS("https://t.me/overbetspb"),
		WorkingHours:    mustJSON(everyDayHours("19:00", "02:00")),
		Games:           []string{"NLH", "MTT"},
		MinBuyInCents:   nil,
		MaxBuyInCents:   nil,
		EntryFeeCents:   ptrI64(100000),
		RakeDescription: "",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMTTSeries),
		SocialLinks: mustJSON(clubs.SocialLinks{
			TelegramChannel: "https://t.me/overbetspb",
			Instagram:       "https://www.instagram.com/pokerspb_club/",
		}),
		Status: db.ClubStatusDraft,
	},

	// source: https://2gis.ru/spb/search/Дойл + https://doylepoker.ru/, checked: 2026-05-24
	{
		Slug:    "doyle-poker-spb",
		Name:    "Doyle Poker Club",
		Address: "Санкт-Петербург, ул. Комсомола, 2",
		Lat:     59.9544,
		Lng:     30.3675,
		Description: "Спортивный покер не на деньги. Турниры, рейтинговая система, " +
			"собственное приложение клуба. Сеть в двух городах (СПб + Москва).",
		Phones:          []string{"+7 (966) 755-18-83"},
		Website:         ptrS("https://doylepoker.ru/"),
		TelegramURL:     ptrS("https://t.me/doylemsk"),
		WorkingHours:    mustJSON(everyDayHours("19:00", "02:00")),
		Games:           []string{"NLH", "MTT"},
		MinBuyInCents:   nil,
		MaxBuyInCents:   nil,
		EntryFeeCents:   ptrI64(100000),
		RakeDescription: "",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMTTSeries),
		SocialLinks: mustJSON(clubs.SocialLinks{
			TelegramChannel: "https://t.me/doylemsk",
		}),
		Status: db.ClubStatusPublished,
	},

	// source: http://jokerclubspb.ru/ + https://t.me/joker_club_spb, checked: 2026-05-24
	{
		Slug:    "joker-club-spb",
		Name:    "Joker Club SPB",
		Address: "Санкт-Петербург, пр. Науки, 25",
		Lat:     60.0067,
		Lng:     30.3957,
		Description: "Спортивно-развлекательное сообщество. Покер и мафия не на деньги, " +
			"ежедневные турниры. Оргвзнос 1000 ₽, рейтинговая система.",
		Phones:          []string{"+7 (995) 629-37-85"},
		Website:         ptrS("http://jokerclubspb.ru/"),
		TelegramURL:     ptrS("https://t.me/joker_club_spb"),
		WorkingHours:    mustJSON(everyDayHours("19:00", "23:59")),
		Games:           []string{"NLH", "MTT", "Mixed"},
		MinBuyInCents:   nil,
		MaxBuyInCents:   nil,
		EntryFeeCents:   ptrI64(100000),
		RakeDescription: "",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMafiaAndPoker),
		SocialLinks: mustJSON(clubs.SocialLinks{
			TelegramChannel: "https://t.me/joker_club_spb",
		}),
		Status: db.ClubStatusPublished,
	},

	// source: https://www.fiesta.ru/spb/places/klub-saint-pokersburg-dlya-igrokov-v-poker-i-mafiyu/ + https://yandex.ru/maps/org/mysterium/144388469235, checked: 2026-05-24
	{
		Slug:    "saint-pokersburg",
		Name:    "Saint-Pokersburg",
		Address: "Санкт-Петербург, Невский пр., 65, 6 этаж (лаунж-бар Mysterium)",
		Lat:     59.9311,
		Lng:     30.3604,
		Description: "Клуб для игроков в покер и «Мафию» на 6 этаже исторического особняка. " +
			"Турниры не на деньги, рейтинговая система, тематический интерьер царской эпохи.",
		Phones:  []string{},
		Website: nil,
		WorkingHours: mustJSON(clubs.WorkingHours{
			Mon: clubs.DaySchedule{Closed: true},
			Tue: clubs.DaySchedule{Closed: true},
			Wed: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "19:00", Close: "23:30"}}},
			Thu: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "19:00", Close: "23:30"}}},
			Fri: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "19:00", Close: "01:00"}}},
			Sat: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "18:00", Close: "01:00"}}},
			Sun: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "18:00", Close: "23:00"}}},
		}),
		Games:           []string{"NLH", "MTT", "Mixed"},
		MinBuyInCents:   nil,
		MaxBuyInCents:   nil,
		EntryFeeCents:   ptrI64(150000),
		RakeDescription: "",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMafiaAndPoker),
		SocialLinks:     mustJSON(clubs.SocialLinks{}),
		Status:          db.ClubStatusPublished,
	},
}
