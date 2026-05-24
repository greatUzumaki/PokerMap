package validate

import (
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"sync"

	"github.com/go-playground/validator/v10"
	"github.com/pokermap/api/internal/httpx"
)

var (
	slugRegex        = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`)
	allowedGames     = map[string]struct{}{"NLH": {}, "PLO": {}, "PLO5": {}, "MTT": {}, "SnG": {}, "Mixed": {}, "Other": {}}
	allowedStatus    = map[string]struct{}{"draft": {}, "published": {}, "archived": {}}
	allowedClubTypes = map[string]struct{}{"cash": {}, "club": {}, "mtt-series": {}, "mafia-and-poker": {}, "underground": {}}
)

var (
	validatorOnce sync.Once
	validatorInst *validator.Validate
)

// AllowedGames returns the set of canonical game codes.
func AllowedGames() map[string]struct{} { return allowedGames }

// AllowedClubTypes returns the set of canonical club types.
func AllowedClubTypes() map[string]struct{} { return allowedClubTypes }

func V() *validator.Validate {
	validatorOnce.Do(func() {
		v := validator.New(validator.WithRequiredStructEnabled())
		_ = v.RegisterValidation("slug", func(fl validator.FieldLevel) bool {
			return slugRegex.MatchString(fl.Field().String())
		})
		_ = v.RegisterValidation("game", func(fl validator.FieldLevel) bool {
			_, ok := allowedGames[fl.Field().String()]
			return ok
		})
		_ = v.RegisterValidation("clubstatus", func(fl validator.FieldLevel) bool {
			_, ok := allowedStatus[fl.Field().String()]
			return ok
		})
		_ = v.RegisterValidation("clubtype", func(fl validator.FieldLevel) bool {
			s := fl.Field().String()
			if s == "" {
				return true
			}
			_, ok := allowedClubTypes[s]
			return ok
		})
		v.RegisterTagNameFunc(func(field reflect.StructField) string {
			tag := field.Tag.Get("json")
			if tag == "" {
				return field.Name
			}
			name := strings.SplitN(tag, ",", 2)[0]
			if name == "-" {
				return ""
			}
			return name
		})
		validatorInst = v
	})
	return validatorInst
}

// Lift validator errors into the standard ErrorDetail shape.
func Details(err error) []httpx.ErrorDetail {
	var ve validator.ValidationErrors
	if !errors.As(err, &ve) {
		return nil
	}
	out := make([]httpx.ErrorDetail, 0, len(ve))
	for _, e := range ve {
		out = append(out, httpx.ErrorDetail{
			Field:   e.Field(),
			Message: messageFor(e),
		})
	}
	return out
}

func messageFor(e validator.FieldError) string {
	switch e.Tag() {
	case "required":
		return "required"
	case "slug":
		return "must match ^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$"
	case "game":
		return "must be one of NLH, PLO, PLO5, MTT, SnG, Mixed, Other"
	case "clubstatus":
		return "must be one of draft, published, archived"
	case "clubtype":
		return "must be one of cash, club, mtt-series, mafia-and-poker, underground"
	case "min", "max", "gte", "lte", "len":
		return fmt.Sprintf("must satisfy %s=%s", e.Tag(), e.Param())
	}
	return e.Tag()
}
