package events

// Kind is the discriminator stored in user_events.kind. Must stay in sync
// with packages/types/src/events.ts.
type Kind string

const (
	KindBotStart           Kind = "bot.start"
	KindAppOpen            Kind = "app.open"
	KindWebPageView        Kind = "web.page_view"
	KindWebFilterApply     Kind = "web.filter_apply"
	KindWebFilterReset     Kind = "web.filter_reset"
	KindWebClubView        Kind = "web.club_view"
	KindWebOpenInMapsClick Kind = "web.openinmaps_click"
	KindWebShareClick      Kind = "web.share_click"
	KindAdminClubCreate    Kind = "admin.club.create"
	KindAdminClubUpdate    Kind = "admin.club.update"
	KindAdminClubPublish   Kind = "admin.club.publish"
	KindAdminClubArchive   Kind = "admin.club.archive"
	KindAdminClubDelete    Kind = "admin.club.delete"
)

// AllKinds is the full whitelist used by the admin endpoint to validate filters.
var AllKinds = []Kind{
	KindBotStart, KindAppOpen,
	KindWebPageView, KindWebFilterApply, KindWebFilterReset, KindWebClubView,
	KindWebOpenInMapsClick, KindWebShareClick,
	KindAdminClubCreate, KindAdminClubUpdate, KindAdminClubPublish, KindAdminClubArchive, KindAdminClubDelete,
}

// PublicKinds is the subset accepted from the browser via POST /v1/events.
var PublicKinds = []Kind{
	KindWebPageView, KindWebFilterApply, KindWebFilterReset, KindWebClubView,
	KindWebOpenInMapsClick, KindWebShareClick,
}

func IsValid(k string) bool {
	for _, v := range AllKinds {
		if string(v) == k {
			return true
		}
	}
	return false
}

func IsPublic(k string) bool {
	for _, v := range PublicKinds {
		if string(v) == k {
			return true
		}
	}
	return false
}
