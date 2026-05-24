package seed

import (
	"encoding/json"

	"github.com/pokermap/api/internal/clubs"
	"github.com/pokermap/api/internal/db"
)

// legacyDemoSlugs were inserted by the original Demo seed. They are deleted
// on every Run so an environment that previously seeded the demo data
// converges on the real SPB catalog.
var legacyDemoSlugs = []string{
	"royal-poker-club",
	"neva-cardroom",
	"petrogradka-poker",
	"moskovsky-poker",
	"vasilevsky-card",
	"kupchino-poker",
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

// spbClubs is the curated catalog of real Saint Petersburg poker venues used
// by the seeder. Each entry cites the source URL it was checked against.
// Coordinates are approximate; operators should verify and edit in the admin.
var spbClubs = []db.CreateClubParams{
	// source: https://2gis.ru/spb/search/Покер%20клуб (Bluff), checked: 2026-05-24
	{
		Slug:    "bluff",
		Name:    "Bluff",
		Address: "Санкт-Петербург, Фурштатская ул., 44",
		Lat:     59.9456,
		Lng:     30.3666,
		Description: "Покерный клуб в центре, кэш-игры NLH/PLO, дневные и вечерние турниры. " +
			"Адрес и телефоны актуализируйте по 2GIS перед публикацией.",
		Phones:          []string{},
		Website:         nil,
		TelegramURL:     ptrS("https://t.me/blefach"),
		WorkingHours:    mustJSON(everyDayHours("18:00", "06:00")),
		Games:           []string{"NLH", "PLO", "MTT"},
		MinBuyInCents:   ptrI64(500000),
		MaxBuyInCents:   ptrI64(5000000),
		EntryFeeCents:   nil,
		RakeDescription: "5% капкан 1000₽",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeCash),
		SocialLinks:     mustJSON(clubs.SocialLinks{TelegramChannel: "https://t.me/blefach"}),
		Status:          db.ClubStatusPublished,
	},
	// source: https://2gis.ru/spb/search/Покер%20клуб (Pulse), checked: 2026-05-24
	{
		Slug:            "pulse",
		Name:            "Pulse",
		Address:         "Санкт-Петербург, Бугский пер., 3, ТОЦ «Андреевский двор» (В.О.)",
		Lat:             59.9437,
		Lng:             30.2802,
		Description:     "Спортивный покерный клуб на Васильевском острове. Турниры и кэш-игры.",
		Phones:          []string{},
		WorkingHours:    mustJSON(everyDayHours("19:00", "07:00")),
		Games:           []string{"NLH", "MTT"},
		MinBuyInCents:   ptrI64(300000),
		MaxBuyInCents:   ptrI64(2000000),
		RakeDescription: "5% капкан 800₽",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMTTSeries),
		SocialLinks:     mustJSON(clubs.SocialLinks{}),
		Status:          db.ClubStatusPublished,
	},
	// source: https://2gis.ru/spb/search/Покер%20клуб (Эло клуб), checked: 2026-05-24
	{
		Slug:            "elo-club",
		Name:            "Эло клуб",
		Address:         "Санкт-Петербург, Каменноостровский пр., 10 лит. Б",
		Lat:             59.9577,
		Lng:             30.3175,
		Description:     "Игровой клуб на Петроградке. Покерные вечера и турниры по выходным.",
		Phones:          []string{},
		WorkingHours:    mustJSON(everyDayHours("18:00", "04:00")),
		Games:           []string{"NLH", "Mixed"},
		MinBuyInCents:   ptrI64(200000),
		MaxBuyInCents:   ptrI64(1000000),
		RakeDescription: "3% капкан 600₽",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeClub),
		SocialLinks:     mustJSON(clubs.SocialLinks{}),
		Status:          db.ClubStatusPublished,
	},
	// source: https://www.fiesta.ru/spb/places/klub-saint-pokersburg-dlya-igrokov-v-poker-i-mafiyu/, checked: 2026-05-24
	{
		Slug:            "saint-pokersburg",
		Name:            "Saint-Pokersburg",
		Address:         "Санкт-Петербург, Невский пр., в лаунж-баре Mysterium",
		Lat:             59.9310,
		Lng:             30.3585,
		Description:     "Интеллектуальный клуб с турнирами по покеру и «Мафии» на любительском уровне.",
		Phones:          []string{},
		WorkingHours: mustJSON(clubs.WorkingHours{
			Mon: clubs.DaySchedule{Closed: true},
			Tue: clubs.DaySchedule{Closed: true},
			Wed: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "19:00", Close: "23:30"}}},
			Thu: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "19:00", Close: "23:30"}}},
			Fri: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "19:00", Close: "01:00"}}},
			Sat: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "18:00", Close: "01:00"}}},
			Sun: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "18:00", Close: "23:00"}}},
		}),
		Games:           []string{"MTT", "Mixed"},
		MinBuyInCents:   nil,
		MaxBuyInCents:   nil,
		EntryFeeCents:   ptrI64(150000),
		RakeDescription: "Фиксированный взнос, без рейка",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMafiaAndPoker),
		SocialLinks:     mustJSON(clubs.SocialLinks{}),
		Status:          db.ClubStatusPublished,
	},
	// source: https://www.obriens.ru/poker, checked: 2026-05-24
	{
		Slug:            "obriens-poker",
		Name:            "O'Briens Poker",
		Address:         "Санкт-Петербург, Невский пр., 25 (паб O'Briens)",
		Lat:             59.9356,
		Lng:             30.3270,
		Description:     "Покерные вечера в ирландском пабе O'Briens. Турниры по расписанию.",
		Phones:          []string{},
		Website:         ptrS("https://www.obriens.ru/poker"),
		WorkingHours: mustJSON(clubs.WorkingHours{
			Mon: clubs.DaySchedule{Closed: true},
			Tue: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "20:00", Close: "02:00"}}},
			Wed: clubs.DaySchedule{Closed: true},
			Thu: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "20:00", Close: "02:00"}}},
			Fri: clubs.DaySchedule{Closed: true},
			Sat: clubs.DaySchedule{Slots: []clubs.DaySlot{{Open: "19:00", Close: "02:00"}}},
			Sun: clubs.DaySchedule{Closed: true},
		}),
		Games:           []string{"NLH", "MTT"},
		MinBuyInCents:   ptrI64(150000),
		MaxBuyInCents:   ptrI64(500000),
		RakeDescription: "Турнирный взнос",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMTTSeries),
		SocialLinks:     mustJSON(clubs.SocialLinks{}),
		Status:          db.ClubStatusPublished,
	},
	// source: https://cromulentclub.orgs.biz/, checked: 2026-05-24
	{
		Slug:            "cromulent-club",
		Name:            "Cromulent Club",
		Address:         "Санкт-Петербург, Владимирский пр., 15 (вход в арке)",
		Lat:             59.9296,
		Lng:             30.3494,
		Description:     "Покерный клуб на платформе PPPoker. Контакт для записи — в Telegram или WhatsApp.",
		Phones:          []string{"+7 (953) 344-33-36"},
		TelegramURL:     ptrS("https://t.me/+79533443336"),
		WorkingHours:    mustJSON(everyDayHours("20:00", "06:00")),
		Games:           []string{"NLH", "PLO"},
		MinBuyInCents:   ptrI64(1000000),
		MaxBuyInCents:   ptrI64(10000000),
		RakeDescription: "5% капкан 1500₽",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeUnderground),
		SocialLinks:     mustJSON(clubs.SocialLinks{}),
		Status:          db.ClubStatusPublished,
	},
	// source: http://jokerclubspb.ru/, checked: 2026-05-24
	// NOTE: address not published on the site; placeholder coords near centre.
	// Operator should update with verified address before publication.
	{
		Slug:            "joker-club-spb",
		Name:            "Joker Club SPB",
		Address:         "Санкт-Петербург (адрес уточняется)",
		Lat:             59.9343,
		Lng:             30.3351,
		Description:     "Спортивно-развлекательный клуб по покеру не на деньги. Любительские турниры.",
		Phones:          []string{},
		Website:         ptrS("http://jokerclubspb.ru/"),
		WorkingHours:    mustJSON(everyDayHours("19:00", "23:59")),
		Games:           []string{"MTT", "NLH"},
		MinBuyInCents:   nil,
		MaxBuyInCents:   nil,
		EntryFeeCents:   ptrI64(50000),
		RakeDescription: "Любительский формат, без денежных ставок",
		PhotoKeys:       []string{},
		ClubType:        string(clubs.ClubTypeMafiaAndPoker),
		SocialLinks:     mustJSON(clubs.SocialLinks{}),
		Status:          db.ClubStatusDraft,
	},
}
