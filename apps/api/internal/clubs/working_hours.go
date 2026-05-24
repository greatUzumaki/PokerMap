package clubs

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// WorkingHours is the canonical schedule shape persisted in clubs.working_hours.
// JSON keys are weekday abbreviations (mon..sun). Each day declares whether
// the venue is closed and an ordered list of open slots. A slot whose close
// time is less than or equal to its open time represents an overnight slot
// that wraps past midnight; close is exclusive and open is inclusive.
type WorkingHours struct {
	Mon DaySchedule `json:"mon"`
	Tue DaySchedule `json:"tue"`
	Wed DaySchedule `json:"wed"`
	Thu DaySchedule `json:"thu"`
	Fri DaySchedule `json:"fri"`
	Sat DaySchedule `json:"sat"`
	Sun DaySchedule `json:"sun"`
}

type DaySchedule struct {
	Closed bool         `json:"closed"`
	Slots  []DaySlot    `json:"slots"`
}

type DaySlot struct {
	Open  string `json:"open"`
	Close string `json:"close"`
}

var DayKeys = []string{"mon", "tue", "wed", "thu", "fri", "sat", "sun"}

func (w WorkingHours) day(key string) DaySchedule {
	switch key {
	case "mon":
		return w.Mon
	case "tue":
		return w.Tue
	case "wed":
		return w.Wed
	case "thu":
		return w.Thu
	case "fri":
		return w.Fri
	case "sat":
		return w.Sat
	case "sun":
		return w.Sun
	}
	return DaySchedule{Closed: true}
}

// Validate enforces schema invariants beyond JSON syntax: every weekday key is
// present, slot times parse as HH:MM, no closed day carries slots, no
// degenerate slots (open == close), at most 4 slots per day.
func (w WorkingHours) Validate() error {
	for _, key := range DayKeys {
		d := w.day(key)
		if err := d.validate(key); err != nil {
			return err
		}
	}
	return nil
}

func (d DaySchedule) validate(key string) error {
	if d.Closed && len(d.Slots) > 0 {
		return fmt.Errorf("%s: closed days cannot have slots", key)
	}
	if len(d.Slots) > 4 {
		return fmt.Errorf("%s: too many slots (max 4)", key)
	}
	for i, s := range d.Slots {
		if err := parseHHMMValid(s.Open); err != nil {
			return fmt.Errorf("%s.slots[%d].open: %w", key, i, err)
		}
		if err := parseHHMMValid(s.Close); err != nil {
			return fmt.Errorf("%s.slots[%d].close: %w", key, i, err)
		}
		if s.Open == s.Close {
			return fmt.Errorf("%s.slots[%d]: open and close must differ", key, i)
		}
	}
	return nil
}

func parseHHMMValid(s string) error {
	_, err := parseHHMM(s)
	return err
}

func parseHHMM(s string) (int, error) {
	if len(s) != 5 || s[2] != ':' {
		return 0, fmt.Errorf("expected HH:MM, got %q", s)
	}
	h, err := strconv.Atoi(s[0:2])
	if err != nil || h < 0 || h > 23 {
		return 0, fmt.Errorf("invalid hour in %q", s)
	}
	m, err := strconv.Atoi(s[3:5])
	if err != nil || m < 0 || m > 59 {
		return 0, fmt.Errorf("invalid minute in %q", s)
	}
	return h*60 + m, nil
}

// IsOpenNow returns true iff now (converted to loc) falls inside any open
// slot of the current weekday OR inside the tail of an overnight slot
// belonging to the previous weekday. Open is inclusive, close is exclusive.
func (w WorkingHours) IsOpenNow(now time.Time, loc *time.Location) bool {
	if loc == nil {
		loc = time.UTC
	}
	local := now.In(loc)
	todayKey := weekdayKey(local.Weekday())
	minutes := local.Hour()*60 + local.Minute()

	today := w.day(todayKey)
	if !today.Closed {
		for _, s := range today.Slots {
			open, errO := parseHHMM(s.Open)
			close_, errC := parseHHMM(s.Close)
			if errO != nil || errC != nil {
				continue
			}
			if close_ > open {
				if minutes >= open && minutes < close_ {
					return true
				}
			} else {
				if minutes >= open {
					return true
				}
			}
		}
	}

	yesterdayKey := DayKeys[(indexOfDay(todayKey)+len(DayKeys)-1)%len(DayKeys)]
	yesterday := w.day(yesterdayKey)
	if yesterday.Closed {
		return false
	}
	for _, s := range yesterday.Slots {
		open, errO := parseHHMM(s.Open)
		close_, errC := parseHHMM(s.Close)
		if errO != nil || errC != nil {
			continue
		}
		if close_ <= open && minutes < close_ {
			return true
		}
	}
	return false
}

func weekdayKey(wd time.Weekday) string {
	switch wd {
	case time.Monday:
		return "mon"
	case time.Tuesday:
		return "tue"
	case time.Wednesday:
		return "wed"
	case time.Thursday:
		return "thu"
	case time.Friday:
		return "fri"
	case time.Saturday:
		return "sat"
	default:
		return "sun"
	}
}

func indexOfDay(key string) int {
	for i, k := range DayKeys {
		if k == key {
			return i
		}
	}
	return 0
}

// MarshalJSONB returns the JSON encoding for storage in a jsonb column.
func (w WorkingHours) MarshalJSONB() (json.RawMessage, error) {
	b, err := json.Marshal(w)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func DecodeWorkingHours(raw json.RawMessage) (WorkingHours, error) {
	var w WorkingHours
	if len(raw) == 0 || string(raw) == "null" {
		return WorkingHours{}, nil
	}
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&w); err != nil {
		return WorkingHours{}, err
	}
	return w, nil
}
