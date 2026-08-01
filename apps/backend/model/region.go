package model

import "gorm.io/gorm"

// RegProvince merepresentasikan tabel reg_provinces
type RegProvince struct {
	ID   string `gorm:"primaryKey;type:char(2)" json:"id"`
	Name string `gorm:"type:varchar(255);not null" json:"name"`
}

// RegRegency merepresentasikan tabel reg_regencies
type RegRegency struct {
	ID         string `gorm:"primaryKey;type:char(4)" json:"id"`
	ProvinceID string `gorm:"type:char(2);not null" json:"province_id"`
	Name       string `gorm:"type:varchar(255);not null" json:"name"`

	// Relasi: Setiap kabupaten/kota dimiliki oleh satu provinsi
	Province RegProvince `gorm:"foreignKey:ProvinceID" json:"-"`
}

// RegDistrict merepresentasikan tabel reg_districts
type RegDistrict struct {
	ID        string `gorm:"primaryKey;type:char(6)" json:"id"`
	RegencyID string `gorm:"type:char(4);not null" json:"regency_id"`
	Name      string `gorm:"type:varchar(255);not null" json:"name"`

	// Relasi: Setiap kecamatan dimiliki oleh satu kabupaten/kota
	Regency RegRegency `gorm:"foreignKey:RegencyID" json:"-"`
}

type RegionMap struct {
	ID   string
	Name string
}

func GetRegionMaps(db *gorm.DB) (map[string]string, map[string]string) {
	pMap := make(map[string]string)
	cMap := make(map[string]string)

	var provinces, cities []RegionMap

	db.Table("reg_provinces").Select("id, name").Scan(&provinces)
	for _, p := range provinces {
		pMap[p.ID] = p.Name
	}

	db.Table("reg_regencies").Select("id, name").Scan(&cities)
	for _, c := range cities {
		cMap[c.ID] = c.Name
	}

	return pMap, cMap
}
