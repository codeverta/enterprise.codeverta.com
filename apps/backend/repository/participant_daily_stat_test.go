package repository

import (
	"testing"
	"time"
)

func TestIncrementMapUsesUnknownForEmptyKey(t *testing.T) {
	m := map[string]int64{}
	incrementMap(m, "")
	incrementMap(m, "Male")
	incrementMap(m, "Male")

	if m["UNKNOWN"] != 1 {
		t.Fatalf("expected UNKNOWN count 1, got %d", m["UNKNOWN"])
	}
	if m["Male"] != 2 {
		t.Fatalf("expected Male count 2, got %d", m["Male"])
	}
}

func TestCalculateAgeGroupBoundaries(t *testing.T) {
	now := time.Now()
	tests := map[string]time.Time{
		"< 18":  now.AddDate(-17, 0, 0),
		"18-29": now.AddDate(-25, 0, 0),
		"30-39": now.AddDate(-35, 0, 0),
		"40-49": now.AddDate(-45, 0, 0),
		"50+":   now.AddDate(-55, 0, 0),
	}

	for expected, dob := range tests {
		got := calculateAgeGroup(dob)
		if got != expected {
			t.Fatalf("expected %s, got %s", expected, got)
		}
	}

	if got := calculateAgeGroup(time.Time{}); got != "UNKNOWN" {
		t.Fatalf("expected UNKNOWN for zero date, got %s", got)
	}
}
