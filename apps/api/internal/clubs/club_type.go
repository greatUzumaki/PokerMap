package clubs

import "fmt"

type ClubType string

const (
	ClubTypeCash           ClubType = "cash"
	ClubTypeClub           ClubType = "club"
	ClubTypeMTTSeries      ClubType = "mtt-series"
	ClubTypeMafiaAndPoker  ClubType = "mafia-and-poker"
	ClubTypeUnderground    ClubType = "underground"
)

var allowedClubTypes = map[ClubType]struct{}{
	ClubTypeCash:          {},
	ClubTypeClub:          {},
	ClubTypeMTTSeries:     {},
	ClubTypeMafiaAndPoker: {},
	ClubTypeUnderground:   {},
}

func ValidClubType(s string) bool {
	_, ok := allowedClubTypes[ClubType(s)]
	return ok
}

func ParseClubType(s string) (ClubType, error) {
	if s == "" {
		return ClubTypeCash, nil
	}
	if !ValidClubType(s) {
		return "", fmt.Errorf("invalid club type %q", s)
	}
	return ClubType(s), nil
}

type SocialLinks struct {
	VK              string `json:"vk,omitempty"`
	Instagram       string `json:"instagram,omitempty"`
	YouTube         string `json:"youtube,omitempty"`
	TelegramChannel string `json:"telegramChannel,omitempty"`
}

func (s SocialLinks) IsEmpty() bool {
	return s.VK == "" && s.Instagram == "" && s.YouTube == "" && s.TelegramChannel == ""
}
