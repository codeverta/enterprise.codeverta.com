package data

import (
	_ "embed"
	"encoding/json"
	"strings"
	"sync"
)

//go:embed countries.json
var countriesJSON []byte

type Country struct {
	ID          string   `json:"id"`
	CountryName string   `json:"country_name"`
	Code        string   `json:"code"`
	DateFormat  string   `json:"date_format"`
	TimeFormat  string   `json:"time_format"`
	TimeZones   []string `json:"time_zones"`
}

var (
	countriesOnce sync.Once
	countriesList []Country
	countriesMap  map[string]Country
)

func initCountries() {
	countriesOnce.Do(func() {
		_ = json.Unmarshal(countriesJSON, &countriesList)
		countriesMap = make(map[string]Country, len(countriesList)*2)
		for _, c := range countriesList {
			countriesMap[strings.ToLower(c.ID)] = c
			countriesMap[strings.ToLower(c.CountryName)] = c
			if c.Code != "" {
				countriesMap[strings.ToLower(c.Code)] = c
			}
		}
	})
}

// GetCountries returns the slice of all countries from the embedded JSON.
func GetCountries() []Country {
	initCountries()
	return countriesList
}

// GetCountry finds a country by ID, country name, or ISO code (case-insensitive).
func GetCountry(identifier string) (Country, bool) {
	initCountries()
	c, ok := countriesMap[strings.ToLower(strings.TrimSpace(identifier))]
	return c, ok
}
