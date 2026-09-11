package controller

import (
	"gin-template/data"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type CountryController struct{}

func NewCountryController() *CountryController {
	return &CountryController{}
}

// List returns the list of countries loaded directly from countries.json without querying the database.
func (ctrl *CountryController) List(c *gin.Context) {
	countries := data.GetCountries()
	query := strings.TrimSpace(strings.ToLower(c.Query("q")))
	if query == "" {
		c.JSON(http.StatusOK, gin.H{"data": countries})
		return
	}

	filtered := make([]data.Country, 0)
	for _, cnt := range countries {
		if strings.Contains(strings.ToLower(cnt.CountryName), query) ||
			strings.Contains(strings.ToLower(cnt.ID), query) ||
			strings.Contains(strings.ToLower(cnt.Code), query) {
			filtered = append(filtered, cnt)
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": filtered})
}

// Get returns details of a single country from countries.json by name, ID, or ISO code.
func (ctrl *CountryController) Get(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	country, found := data.GetCountry(id)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "country not found"})
		return
	}

	c.JSON(http.StatusOK, country)
}
