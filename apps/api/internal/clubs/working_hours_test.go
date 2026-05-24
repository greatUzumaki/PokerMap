package clubs

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type fixtureCase struct {
	Name     string       `json:"name"`
	Hours    WorkingHours `json:"hours"`
	Now      time.Time    `json:"now"`
	TZ       string       `json:"tz"`
	Expected bool         `json:"expected"`
}

func TestIsOpenNow_SharedFixture(t *testing.T) {
	path := filepath.Join("..", "..", "..", "..", "packages", "types", "test-fixtures", "working-hours-cases.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("fixture not available: %v", err)
	}
	var cases []fixtureCase
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatalf("unmarshal fixture: %v", err)
	}
	for _, c := range cases {
		c := c
		t.Run(c.Name, func(t *testing.T) {
			loc, err := time.LoadLocation(c.TZ)
			if err != nil {
				t.Fatalf("LoadLocation: %v", err)
			}
			got := c.Hours.IsOpenNow(c.Now, loc)
			if got != c.Expected {
				t.Fatalf("isOpenNow=%v want=%v", got, c.Expected)
			}
		})
	}
}

func TestWorkingHours_Validate(t *testing.T) {
	loc, _ := time.LoadLocation("Europe/Moscow")
	_ = loc
	cases := []struct {
		name    string
		input   WorkingHours
		wantErr bool
	}{
		{
			name: "valid full week",
			input: WorkingHours{
				Mon: DaySchedule{Slots: []DaySlot{{Open: "12:00", Close: "20:00"}}},
				Tue: DaySchedule{Closed: true},
				Wed: DaySchedule{Closed: true},
				Thu: DaySchedule{Closed: true},
				Fri: DaySchedule{Slots: []DaySlot{{Open: "20:00", Close: "06:00"}}},
				Sat: DaySchedule{Closed: true},
				Sun: DaySchedule{Closed: true},
			},
		},
		{
			name: "closed with slots is rejected",
			input: WorkingHours{
				Wed: DaySchedule{Closed: true, Slots: []DaySlot{{Open: "10:00", Close: "12:00"}}},
			},
			wantErr: true,
		},
		{
			name: "degenerate slot rejected",
			input: WorkingHours{
				Mon: DaySchedule{Slots: []DaySlot{{Open: "10:00", Close: "10:00"}}},
			},
			wantErr: true,
		},
		{
			name: "bad time format rejected",
			input: WorkingHours{
				Mon: DaySchedule{Slots: []DaySlot{{Open: "10:0", Close: "11:00"}}},
			},
			wantErr: true,
		},
	}
	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			err := c.input.Validate()
			if (err != nil) != c.wantErr {
				t.Fatalf("err=%v wantErr=%v", err, c.wantErr)
			}
		})
	}
}

func TestParseClubType(t *testing.T) {
	for _, s := range []string{"cash", "club", "mtt-series", "mafia-and-poker", "underground", ""} {
		if _, err := ParseClubType(s); err != nil {
			t.Errorf("expected %q ok, got %v", s, err)
		}
	}
	if _, err := ParseClubType("casino"); err == nil {
		t.Errorf("expected error for invalid")
	}
}
