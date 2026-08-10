package model

import (
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SeedOrganizationData populates default Multi-Company, Multi-Branch, and Multi-Department structures
func SeedOrganizationData(db *gorm.DB, tenantID uuid.UUID) error {
	if tenantID == uuid.Nil {
		// Attempt to fetch first tenant if nil
		var tenant Tenant
		if err := db.First(&tenant).Error; err != nil {
			log.Println("[OrganizationSeeder] No tenant found, skipping seeder:", err)
			return nil
		}
		tenantID = tenant.ID
	}

	// 1. Seed Multi-Company
	pztsCompany := Company{
		TenantID:     tenantID,
		Name:         "PT Codeverta Utama (PZTS)",
		Abbreviation: "PZTS",
		TaxID:        "01.234.567.8-012.000",
		Domain:       "pzts.codeverta.com",
		Email:        "contact@pzts.codeverta.com",
		Phone:        "+62215551234",
		Address:      "Jl. Sudirman No. 100, Jakarta Selatan",
		Currency:     "IDR",
		IsGroup:      true,
		IsActive:     true,
	}
	if err := db.Where("tenant_id = ? AND abbreviation = ?", tenantID, "PZTS").FirstOrCreate(&pztsCompany).Error; err != nil {
		return err
	}

	mcCompany := Company{
		TenantID:     tenantID,
		Name:         "PT Codeverta Mandiri (MC)",
		Abbreviation: "MC",
		TaxID:        "02.987.654.3-098.000",
		Domain:       "mc.codeverta.com",
		Email:        "contact@mc.codeverta.com",
		Phone:        "+62315555678",
		Address:      "Jl. Pemuda No. 50, Surabaya",
		Currency:     "IDR",
		IsGroup:      false,
		IsActive:     true,
	}
	if err := db.Where("tenant_id = ? AND abbreviation = ?", tenantID, "MC").FirstOrCreate(&mcCompany).Error; err != nil {
		return err
	}

	// 2. Seed Multi-Branch
	pztsBranch := Branch{
		TenantID:   tenantID,
		CompanyID:  pztsCompany.ID,
		Name:       "PZTS Head Office Jakarta",
		BranchCode: "JKT-01",
		Address:    "Jl. Sudirman No. 100, Jakarta Selatan",
		Phone:      "+62215551234",
		Email:      "jkt@pzts.codeverta.com",
		IsActive:   true,
	}
	if err := db.Where("tenant_id = ? AND branch_code = ?", tenantID, "JKT-01").FirstOrCreate(&pztsBranch).Error; err != nil {
		return err
	}

	mcBranch := Branch{
		TenantID:   tenantID,
		CompanyID:  mcCompany.ID,
		Name:       "MC Head Office Surabaya",
		BranchCode: "SBY-01",
		Address:    "Jl. Pemuda No. 50, Surabaya",
		Phone:      "+62315555678",
		Email:      "sby@mc.codeverta.com",
		IsActive:   true,
	}
	if err := db.Where("tenant_id = ? AND branch_code = ?", tenantID, "SBY-01").FirstOrCreate(&mcBranch).Error; err != nil {
		return err
	}

	// 3. Seed Root Parent Department: "All Departments"
	rootDept := Department{
		TenantID:       tenantID,
		CompanyID:      &pztsCompany.ID,
		BranchID:       &pztsBranch.ID,
		Name:           "All Departments",
		DepartmentCode: "ALL",
		IsGroup:        true,
		IsActive:       true,
	}
	if err := db.Where("tenant_id = ? AND name = ?", tenantID, "All Departments").FirstOrCreate(&rootDept).Error; err != nil {
		return err
	}

	// 4. Seed PZTS Departments under "All Departments"
	pztsDepts := []string{
		"Accounts",
		"Marketing",
		"Sales",
		"Purchase",
		"Operations",
		"Production",
		"Dispatch",
		"Customer Service",
		"Human Resources",
		"Management",
		"Quality Management",
		"Research & Development",
		"Legal",
	}

	for _, deptName := range pztsDepts {
		fullName := deptName + " - PZTS"
		dept := Department{
			TenantID:           tenantID,
			CompanyID:          &pztsCompany.ID,
			BranchID:           &pztsBranch.ID,
			Name:               fullName,
			DepartmentCode:     deptName,
			ParentDepartmentID: &rootDept.ID,
			IsGroup:            false,
			IsActive:           true,
		}
		if err := db.Where("tenant_id = ? AND name = ?", tenantID, fullName).FirstOrCreate(&dept).Error; err != nil {
			log.Printf("[OrganizationSeeder] Error creating department %s: %v\n", fullName, err)
		}
	}

	// 5. Seed MC Departments under "All Departments"
	mcDepts := []string{
		"Accounts",
		"Marketing",
		"Sales",
		"Purchase",
		"Operations",
		"Production",
	}

	for _, deptName := range mcDepts {
		fullName := deptName + " - MC"
		dept := Department{
			TenantID:           tenantID,
			CompanyID:          &mcCompany.ID,
			BranchID:           &mcBranch.ID,
			Name:               fullName,
			DepartmentCode:     deptName,
			ParentDepartmentID: &rootDept.ID,
			IsGroup:            false,
			IsActive:           true,
		}
		if err := db.Where("tenant_id = ? AND name = ?", tenantID, fullName).FirstOrCreate(&dept).Error; err != nil {
			log.Printf("[OrganizationSeeder] Error creating department %s: %v\n", fullName, err)
		}
	}

	// 6. Seed Letter Head
	pztsLetterHead := LetterHead{
		TenantID:   tenantID,
		CompanyID:  &pztsCompany.ID,
		Name:       "Standard Letter Head - PZTS",
		HeaderHTML: "<div style='text-align: center;'><h2>PT CODEVERTA UTAMA (PZTS)</h2><p>Jl. Sudirman No. 100, Jakarta | Telp: +62215551234</p><hr/></div>",
		FooterHTML: "<div style='text-align: center;'><hr/><p>Dokumen resmi yang diterbitkan secara otomatis oleh Codeverta ERP</p></div>",
		IsDefault:  true,
		IsActive:   true,
	}
	if err := db.Where("tenant_id = ? AND name = ?", tenantID, pztsLetterHead.Name).FirstOrCreate(&pztsLetterHead).Error; err != nil {
		return err
	}

	log.Println("[OrganizationSeeder] Successfully seeded Multi-Company, Multi-Branch, and Multi-Department hierarchy!")
	return nil
}
