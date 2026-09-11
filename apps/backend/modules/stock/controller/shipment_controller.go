package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ShipmentController struct{}

func NewShipmentController() *ShipmentController {
	return &ShipmentController{}
}

func stockDB(ctx *gin.Context) *gorm.DB {
	return model.GetDB(ctx).WithContext(ctx.Request.Context())
}

func stockTenant(ctx *gin.Context) string {
	return strings.TrimSpace(ctx.GetString("tenant_id"))
}

func (ctrl *ShipmentController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)
	var shipments []stockmodel.Shipment
	query := db.Preload("Parcels").Preload("DeliveryNotes").
		Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("number LIKE ? OR carrier LIKE ? OR awb_number LIKE ? OR delivery_customer LIKE ?", like, like, like, like)
	}

	if err := query.Order("created_at desc").Find(&shipments).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Shipment"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": shipments})
}

func (ctrl *ShipmentController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var shipment stockmodel.Shipment
	if err := db.Preload("Parcels").Preload("DeliveryNotes").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR number = ?)", tenant, id, id).
		First(&shipment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Shipment tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail Shipment"})
		return
	}
	ctx.JSON(http.StatusOK, shipment)
}

func (ctrl *ShipmentController) Create(ctx *gin.Context) {
	var input stockmodel.Shipment
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Shipment tidak valid"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	now := time.Now()

	input.ID = "ship-" + uuid.NewString()[:8]
	input.TenantID = tenant
	if input.Number == "" {
		input.Number = fmt.Sprintf("MAT-SHP-%s-%05d", now.Format("2006"), now.Unix()%100000)
	}
	if input.Status == "" {
		input.Status = stockmodel.ShipmentStatusDraft
	}
	input.CreatedAt = now
	input.UpdatedAt = now

	// Calculate Total Weight
	var totalWeight float64
	for i := range input.Parcels {
		input.Parcels[i].ID = "shpp-" + uuid.NewString()[:8]
		input.Parcels[i].ShipmentID = input.ID
		input.Parcels[i].Idx = i + 1
		if input.Parcels[i].Count <= 0 {
			input.Parcels[i].Count = 1
		}
		totalWeight += input.Parcels[i].Weight * float64(input.Parcels[i].Count)
	}
	input.TotalWeight = totalWeight

	for i := range input.DeliveryNotes {
		input.DeliveryNotes[i].ID = "shpdn-" + uuid.NewString()[:8]
		input.DeliveryNotes[i].ShipmentID = input.ID
		input.DeliveryNotes[i].Idx = i + 1
	}

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Shipment"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *ShipmentController) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	var input stockmodel.Shipment
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Shipment tidak valid"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	var existing stockmodel.Shipment
	if err := db.Preload("Parcels").Preload("DeliveryNotes").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Shipment tidak ditemukan"})
		return
	}

	// Update fields
	existing.Status = input.Status
	existing.PickupFromType = input.PickupFromType
	existing.PickupCompany = input.PickupCompany
	existing.PickupAddressName = input.PickupAddressName
	existing.PickupAddress = input.PickupAddress
	existing.PickupContactPerson = input.PickupContactPerson
	existing.PickupContact = input.PickupContact

	existing.DeliveryToType = input.DeliveryToType
	existing.DeliveryCustomer = input.DeliveryCustomer
	existing.DeliveryAddressName = input.DeliveryAddressName
	existing.DeliveryAddress = input.DeliveryAddress
	existing.DeliveryContactPerson = input.DeliveryContactPerson
	existing.DeliveryContact = input.DeliveryContact

	existing.Pallets = input.Pallets
	existing.ValueOfGoods = input.ValueOfGoods
	existing.PickupDate = input.PickupDate
	existing.PickupFromTime = input.PickupFromTime
	existing.PickupToTime = input.PickupToTime
	existing.ShipmentType = input.ShipmentType
	existing.PickupType = input.PickupType
	existing.Incoterm = input.Incoterm
	existing.DescriptionOfContent = input.DescriptionOfContent

	existing.ServiceProvider = input.ServiceProvider
	existing.ShipmentID = input.ShipmentID
	existing.ShipmentAmount = input.ShipmentAmount
	existing.Carrier = input.Carrier
	existing.CarrierService = input.CarrierService
	existing.AWBNumber = input.AWBNumber
	existing.TrackingStatus = input.TrackingStatus
	existing.UpdatedAt = time.Now()

	var totalWeight float64
	for i := range input.Parcels {
		if input.Parcels[i].Count <= 0 {
			input.Parcels[i].Count = 1
		}
		totalWeight += input.Parcels[i].Weight * float64(input.Parcels[i].Count)
	}
	existing.TotalWeight = totalWeight

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("shipment_id = ?", existing.ID).Delete(&stockmodel.ShipmentParcel{}).Error; err != nil {
			return err
		}
		if err := tx.Where("shipment_id = ?", existing.ID).Delete(&stockmodel.ShipmentDeliveryNote{}).Error; err != nil {
			return err
		}

		for i := range input.Parcels {
			input.Parcels[i].ID = "shpp-" + uuid.NewString()[:8]
			input.Parcels[i].ShipmentID = existing.ID
			input.Parcels[i].Idx = i + 1
			if err := tx.Create(&input.Parcels[i]).Error; err != nil {
				return err
			}
		}

		for i := range input.DeliveryNotes {
			input.DeliveryNotes[i].ID = "shpdn-" + uuid.NewString()[:8]
			input.DeliveryNotes[i].ShipmentID = existing.ID
			input.DeliveryNotes[i].Idx = i + 1
			if err := tx.Create(&input.DeliveryNotes[i]).Error; err != nil {
				return err
			}
		}

		return tx.Save(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Shipment"})
		return
	}

	db.Preload("Parcels").Preload("DeliveryNotes").First(&existing, "id = ?", existing.ID)
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *ShipmentController) Submit(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var shipment stockmodel.Shipment
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&shipment).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Shipment tidak ditemukan"})
		return
	}

	shipment.Status = stockmodel.ShipmentStatusSubmitted
	shipment.UpdatedAt = time.Now()
	if err := db.Save(&shipment).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal submit Shipment"})
		return
	}
	ctx.JSON(http.StatusOK, shipment)
}

func (ctrl *ShipmentController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&stockmodel.Shipment{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Shipment"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Shipment terhapus"})
}

func (ctrl *ShipmentController) Options(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Fetch real companies from db
	var companies []model.Company
	_ = db.Where("tenant_id = ? OR tenant_id = '00000000-0000-0000-0000-000000000000' OR tenant_id IS NULL", tenant).
		Order("name asc").
		Find(&companies).Error

	companyNames := make([]string, 0, len(companies))
	for _, c := range companies {
		if c.Name != "" {
			companyNames = append(companyNames, c.Name)
		}
	}
	if len(companyNames) == 0 {
		companyNames = []string{
			"",
			"PT Codeverta Enterprise",
		}
	}

	// Fetch real users from db
	type UserRow struct {
		ID          string `json:"id"`
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		Email       string `json:"email"`
	}
	var users []UserRow
	_ = db.Model(&model.User{}).
		Select("id, username, display_name, email").
		Order("display_name asc, username asc").
		Limit(100).
		Scan(&users).Error

	// Fetch real customers from db
	type CustomerRow struct {
		ID           string `json:"id"`
		CustomerName string `json:"customer_name"`
		CustomerType string `json:"customer_type"`
		Email        string `json:"email"`
		Phone        string `json:"phone"`
	}
	var customers []CustomerRow
	_ = db.Table("selling_customers").
		Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).
		Select("id, customer_name, customer_type, email, phone").
		Order("customer_name asc").
		Limit(100).
		Scan(&customers).Error

	// Fetch real delivery notes from db
	type DeliveryNoteRow struct {
		Number   string  `json:"number"`
		Customer string  `json:"customer"`
		Total    float64 `json:"total"`
		Status   string  `json:"status"`
	}
	var dns []DeliveryNoteRow
	_ = db.Model(&stockmodel.DeliveryNote{}).
		Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).
		Select("number, customer, COALESCE(rounded_total, grand_total, total) as total, status").
		Order("created_at desc").
		Limit(100).
		Scan(&dns).Error

	ctx.JSON(http.StatusOK, gin.H{
		"companies":        companyNames,
		"users":            users,
		"customers":        customers,
		"delivery_notes":   dns,
		"incoterms":        []string{"EXW", "FOB", "CIF", "DDP", "CFR", "CIP", "DAP"},
		"service_providers": []string{"JNE", "J&T Express", "SiCepat", "DHL Express", "FedEx", "POS Indonesia"},
		"parcel_templates": []string{"Small Box (20x15x10 cm)", "Medium Box (30x20x15 cm)", "Large Box (40x30x20 cm)", "Custom Envelope"},
	})
}
