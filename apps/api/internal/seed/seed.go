package seed

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/pokermap/api/internal/db"
)

// Curated demo clubs for development. Coordinates are approximate central
// locations in Saint Petersburg; replace with verified data before public launch.
var demoClubs = []db.CreateClubParams{
	{
		Slug:            "royal-poker-club",
		Name:            "Royal Poker Club",
		Address:         "Невский проспект, Санкт-Петербург",
		Lat:             59.9343,
		Lng:             30.3351,
		Description:     "Демо-данные. Замените реальной информацией.",
		Phones:          []string{"+7 (812) 000-00-00"},
		WorkingHours:    json.RawMessage(everyDay("18:00", "06:00")),
		Games:           []string{"NLH", "PLO", "MTT"},
		RakeDescription: "5% капкан 1000₽",
		PhotoKeys:       []string{},
		Status:          db.ClubStatusPublished,
	},
	{
		Slug:            "neva-cardroom",
		Name:            "Neva Cardroom",
		Address:         "Васильевский остров, Санкт-Петербург",
		Lat:             59.9410,
		Lng:             30.2615,
		Description:     "Демо-данные. Замените реальной информацией.",
		Phones:          []string{"+7 (812) 111-11-11"},
		WorkingHours:    json.RawMessage(everyDay("16:00", "04:00")),
		Games:           []string{"NLH", "PLO5"},
		RakeDescription: "5% капкан 800₽",
		PhotoKeys:       []string{},
		Status:          db.ClubStatusPublished,
	},
	{
		Slug:            "petrogradka-poker",
		Name:            "Petrogradka Poker",
		Address:         "Петроградская сторона, Санкт-Петербург",
		Lat:             59.9637,
		Lng:             30.3122,
		Description:     "Демо-данные. Замените реальной информацией.",
		Phones:          []string{"+7 (812) 222-22-22"},
		WorkingHours:    json.RawMessage(everyDay("19:00", "07:00")),
		Games:           []string{"NLH", "MTT", "SnG"},
		RakeDescription: "5% капкан 1200₽",
		PhotoKeys:       []string{},
		Status:          db.ClubStatusPublished,
	},
	{
		Slug:            "moskovsky-poker",
		Name:            "Московский Покер",
		Address:         "Московский проспект, Санкт-Петербург",
		Lat:             59.8985,
		Lng:             30.3193,
		Description:     "Демо-данные. Замените реальной информацией.",
		Phones:          []string{"+7 (812) 333-33-33"},
		WorkingHours:    json.RawMessage(everyDay("17:00", "05:00")),
		Games:           []string{"NLH"},
		RakeDescription: "Без рейка",
		PhotoKeys:       []string{},
		Status:          db.ClubStatusPublished,
	},
	{
		Slug:            "vasilevsky-card",
		Name:            "Vasilevsky Card Lounge",
		Address:         "ул. Большой проспект В.О., Санкт-Петербург",
		Lat:             59.9469,
		Lng:             30.2756,
		Description:     "Демо-данные. Замените реальной информацией.",
		Phones:          []string{"+7 (812) 444-44-44"},
		WorkingHours:    json.RawMessage(everyDay("20:00", "08:00")),
		Games:           []string{"NLH", "Mixed"},
		RakeDescription: "3% капкан 600₽",
		PhotoKeys:       []string{},
		Status:          db.ClubStatusPublished,
	},
	{
		Slug:            "kupchino-poker",
		Name:            "Купчино Poker House",
		Address:         "ул. Купчинская, Санкт-Петербург",
		Lat:             59.8281,
		Lng:             30.3784,
		Description:     "Демо-данные. Замените реальной информацией.",
		Phones:          []string{"+7 (812) 555-55-55"},
		WorkingHours:    json.RawMessage(everyDay("18:00", "06:00")),
		Games:           []string{"NLH", "PLO"},
		RakeDescription: "5% капкан 1000₽",
		PhotoKeys:       []string{},
		Status:          db.ClubStatusPublished,
	},
}

func everyDay(open, close string) string {
	slot := fmt.Sprintf(`{"closed":false,"slots":[{"open":%q,"close":%q}]}`, open, close)
	return fmt.Sprintf(`{"mon":%s,"tue":%s,"wed":%s,"thu":%s,"fri":%s,"sat":%s,"sun":%s}`,
		slot, slot, slot, slot, slot, slot, slot)
}

func Run(ctx context.Context, q *db.Queries, logger *slog.Logger) error {
	for _, c := range demoClubs {
		_, err := q.CreateClub(ctx, c)
		if err != nil {
			// Tolerate duplicate-slug runs by skipping.
			logger.Warn("seed: skipping club", "slug", c.Slug, "err", err)
			continue
		}
		logger.Info("seed: inserted club", "slug", c.Slug)
	}
	return nil
}
