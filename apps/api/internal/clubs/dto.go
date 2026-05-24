package clubs

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/pokermap/api/internal/db"
)

type ClubDTO struct {
	ID              uuid.UUID    `json:"id"`
	Slug            string       `json:"slug"`
	Name            string       `json:"name"`
	Address         string       `json:"address"`
	Lat             float64      `json:"lat"`
	Lng             float64      `json:"lng"`
	Description     string       `json:"description"`
	Phones          []string     `json:"phones"`
	Website         *string      `json:"website"`
	TelegramURL     *string      `json:"telegramUrl"`
	WorkingHours    WorkingHours `json:"workingHours"`
	Games           []string     `json:"games"`
	MinBuyInCents   *int64       `json:"minBuyInCents"`
	MaxBuyInCents   *int64       `json:"maxBuyInCents"`
	EntryFeeCents   *int64       `json:"entryFeeCents"`
	RakeDescription string       `json:"rakeDescription"`
	PhotoKeys       []string     `json:"photoKeys"`
	ClubType        string       `json:"clubType"`
	SocialLinks     SocialLinks  `json:"socialLinks"`
	Status          string       `json:"status"`
	CreatedAt       time.Time    `json:"createdAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`
}

func ToDTO(c db.Club) ClubDTO {
	wh, _ := DecodeWorkingHours(c.WorkingHours)
	var sl SocialLinks
	if len(c.SocialLinks) > 0 {
		_ = json.Unmarshal(c.SocialLinks, &sl)
	}
	ct := c.ClubType
	if ct == "" {
		ct = string(ClubTypeCash)
	}
	return ClubDTO{
		ID:              c.ID,
		Slug:            c.Slug,
		Name:            c.Name,
		Address:         c.Address,
		Lat:             c.Lat,
		Lng:             c.Lng,
		Description:     c.Description,
		Phones:          c.Phones,
		Website:         c.Website,
		TelegramURL:     c.TelegramURL,
		WorkingHours:    wh,
		Games:           c.Games,
		MinBuyInCents:   c.MinBuyInCents,
		MaxBuyInCents:   c.MaxBuyInCents,
		EntryFeeCents:   c.EntryFeeCents,
		RakeDescription: c.RakeDescription,
		PhotoKeys:       c.PhotoKeys,
		ClubType:        ct,
		SocialLinks:     sl,
		Status:          string(c.Status),
		CreatedAt:       c.CreatedAt,
		UpdatedAt:       c.UpdatedAt,
	}
}

type ClubsList struct {
	Items      []ClubDTO `json:"items"`
	NextCursor *string   `json:"nextCursor"`
}

type CreateRequest struct {
	Slug            string       `json:"slug" validate:"required,slug"`
	Name            string       `json:"name" validate:"required,min=1,max=200"`
	Address         string       `json:"address" validate:"required,min=1,max=500"`
	Lat             float64      `json:"lat" validate:"required,gte=-90,lte=90"`
	Lng             float64      `json:"lng" validate:"required,gte=-180,lte=180"`
	Description     string       `json:"description" validate:"max=20000"`
	Phones          []string     `json:"phones" validate:"dive,max=40"`
	Website         *string      `json:"website" validate:"omitempty,url"`
	TelegramURL     *string      `json:"telegramUrl" validate:"omitempty,url"`
	WorkingHours    WorkingHours `json:"workingHours"`
	Games           []string     `json:"games" validate:"dive,game"`
	MinBuyInCents   *int64       `json:"minBuyInCents" validate:"omitempty,gte=0"`
	MaxBuyInCents   *int64       `json:"maxBuyInCents" validate:"omitempty,gte=0"`
	EntryFeeCents   *int64       `json:"entryFeeCents" validate:"omitempty,gte=0"`
	RakeDescription string       `json:"rakeDescription" validate:"max=500"`
	PhotoKeys       []string     `json:"photoKeys"`
	ClubType        string       `json:"clubType" validate:"omitempty,clubtype"`
	SocialLinks     SocialLinks  `json:"socialLinks"`
	Status          string       `json:"status" validate:"omitempty,clubstatus"`
}

type UpdateRequest struct {
	Slug            *string       `json:"slug" validate:"omitempty,slug"`
	Name            *string       `json:"name" validate:"omitempty,min=1,max=200"`
	Address         *string       `json:"address" validate:"omitempty,min=1,max=500"`
	Lat             *float64      `json:"lat" validate:"omitempty,gte=-90,lte=90"`
	Lng             *float64      `json:"lng" validate:"omitempty,gte=-180,lte=180"`
	Description     *string       `json:"description" validate:"omitempty,max=20000"`
	Phones          []string      `json:"phones" validate:"dive,max=40"`
	Website         *string       `json:"website" validate:"omitempty,url"`
	TelegramURL     *string       `json:"telegramUrl" validate:"omitempty,url"`
	WorkingHours    *WorkingHours `json:"workingHours"`
	Games           []string      `json:"games" validate:"dive,game"`
	MinBuyInCents   *int64        `json:"minBuyInCents" validate:"omitempty,gte=0"`
	MaxBuyInCents   *int64        `json:"maxBuyInCents" validate:"omitempty,gte=0"`
	EntryFeeCents   *int64        `json:"entryFeeCents" validate:"omitempty,gte=0"`
	RakeDescription *string       `json:"rakeDescription" validate:"omitempty,max=500"`
	PhotoKeys       []string      `json:"photoKeys"`
	ClubType        *string       `json:"clubType" validate:"omitempty,clubtype"`
	SocialLinks     *SocialLinks  `json:"socialLinks"`
	Status          *string       `json:"status" validate:"omitempty,clubstatus"`
}
