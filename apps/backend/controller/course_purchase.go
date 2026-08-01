package controller

import (
	"fmt"
	"gin-template/model"
	"gin-template/services"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// POST /api/lms/courses/:id/purchase — initiate a one-time course purchase
func (ctrl *LMSController) PurchaseCourse(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "LMSController"), zap.String("function", "PurchaseCourse"))
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		log.Warn("Invalid course ID parameter")
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		log.Warn("Failed to extract current LMS user")
		return
	}

	log = log.With(zap.String("course_id", courseID.String()), zap.String("user_id", userID.String()), zap.Int("role", role))

	// Only students (role 20), parents (role 10), and mentors (role 30) can purchase
	if role != 10 && role != 20 && role != 30 {
		log.Warn("Purchase attempted by non-eligible role")
		sendError(c, http.StatusForbidden, "Role Anda tidak dapat membeli kursus", nil)
		return
	}

	var req struct {
		PaymentMethod string `json:"payment_method" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn("Invalid JSON payload for PurchaseCourse", zap.Error(err))
		sendBadRequest(c, "payment_method wajib diisi", nil)
		return
	}

	log = log.With(zap.String("payment_method", req.PaymentMethod))
	db := lmsDB(c, ctrl.DB).WithContext(c)

	var course model.Course
	if err := db.First(&course, "id = ?", courseID).Error; err != nil {
		log.Warn("Course not found for purchase", zap.Error(err))
		sendError(c, http.StatusNotFound, "Kursus tidak ditemukan", nil)
		return
	}
	if course.Price <= 0 {
		log.Warn("Attempted purchase of free or zero-price course", zap.Float64("price", course.Price))
		sendError(c, http.StatusBadRequest, "Kursus ini gratis atau belum memiliki harga", nil)
		return
	}

	// Check if already purchased
	var existing int64
	db.Model(&model.CoursePurchase{}).Where("course_id = ? AND student_id = ? AND status = ?", courseID, userID, model.PurchasePaid).Count(&existing)
	if existing > 0 {
		log.Info("Course already purchased by user")
		sendError(c, http.StatusConflict, "Anda sudah memiliki kursus ini", nil)
		return
	}

	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		log.Error("User record not found", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	purchaseID := uuid.New()
	purchase := model.CoursePurchase{
		ID:        purchaseID,
		CourseID:  courseID,
		StudentID: userID,
		Amount:    course.Price,
		Status:    model.PurchasePending,
	}
	if err := db.Create(&purchase).Error; err != nil {
		log.Error("Failed to create course purchase record", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	paymentID := uuid.New()
	payment := model.LMSPayment{
		ID:         paymentID,
		ParentID:   userID, // self purchase
		StudentID:  userID,
		CourseID:   &courseID,
		Provider:   "xendit",
		ExternalID: purchase.ID.String(), // Tie external_id to purchase.ID
		Amount:     course.Price,
		Currency:   "IDR",
		Status:     model.LMSPaymentPending,
	}
	if err := db.Create(&payment).Error; err != nil {
		log.Error("Failed to create LMS payment record", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	paymentResult, err := services.CreateLMSXenditPaymentRequest(c, db, &payment, user, req.PaymentMethod)
	if err != nil {
		log.Error("Failed to create Xendit payment request", zap.Error(err))
		sendError(c, http.StatusBadGateway, err.Error(), nil)
		return
	}
	paymentResult.PlanAmount = course.Price
	paymentResult.ChargeAmount = course.Price
	paymentResult.FinalAmount = course.Price
	paymentResult.TotalAmount = payment.TotalAmount

	methods, _ := services.BuildPaymentMethodOptions(db, course.Price)

	log.Info("Course purchase payment created successfully",
		zap.String("purchase_id", purchaseID.String()),
		zap.String("payment_id", paymentID.String()),
		zap.Float64("amount", course.Price),
	)

	sendSuccess(c, gin.H{
		"course":           course,
		"purchase":         purchase,
		"payment":          payment,
		"payment_data":     paymentResult,
		"payment_methods":  methods,
		"requires_payment": true,
	}, "Pembayaran kursus berhasil dibuat")
}

// POST /api/lms/courses/:id/confirm-purchase — confirm payment (simulated/manual)
func (ctrl *LMSController) ConfirmCoursePurchase(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "LMSController"), zap.String("function", "ConfirmCoursePurchase"))
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		log.Warn("Invalid course ID parameter")
		return
	}
	userID, _, ok := currentLMSUser(c)
	if !ok {
		log.Warn("Failed to extract current LMS user")
		return
	}

	var req struct {
		PurchaseID string `json:"purchase_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn("Invalid JSON payload for ConfirmCoursePurchase", zap.Error(err))
		sendBadRequest(c, "purchase_id wajib diisi", nil)
		return
	}

	purchaseID, err := uuid.Parse(req.PurchaseID)
	if err != nil {
		log.Warn("Invalid purchase ID string", zap.String("raw_purchase_id", req.PurchaseID))
		sendBadRequest(c, "ID pembelian tidak valid", nil)
		return
	}

	log = log.With(zap.String("course_id", courseID.String()), zap.String("user_id", userID.String()), zap.String("purchase_id", purchaseID.String()))

	db := lmsDB(c, ctrl.DB).WithContext(c)
	now := time.Now()

	err = db.Transaction(func(tx *gorm.DB) error {
		var purchase model.CoursePurchase
		if err := tx.Where("id = ? AND course_id = ? AND student_id = ?", purchaseID, courseID, userID).First(&purchase).Error; err != nil {
			return err
		}
		if purchase.Status != model.PurchasePending {
			return gorm.ErrInvalidTransaction
		}

		if err := tx.Model(&purchase).Updates(map[string]interface{}{
			"status":  model.PurchasePaid,
			"paid_at": &now,
		}).Error; err != nil {
			return err
		}

		// Resolve course owner and credit wallet using wallet engine
		var course model.Course
		if err := tx.Preload("Mentors").First(&course, "id = ?", courseID).Error; err != nil {
			return err
		}

		target, err := ResolveCourseRevenueWallet(tx, &course)
		if err != nil {
			return err
		}

		// Ensure target wallet exists
		tenantID := uuid.Nil
		if purchase.TenantID != nil {
			tenantID = *purchase.TenantID
		}
		targetWallet, err := EnsureWallet(tx, target.OwnerType, target.OwnerID, tenantID)
		if err != nil {
			return err
		}

		// Ensure platform wallet exists
		platformWallet, err := EnsureWallet(tx, model.WalletOwnerPlatform, uuid.Nil, tenantID)
		if err != nil {
			return err
		}

		// Calculate platform fee
		feeResult, err := CalculateFee(purchase.Amount, "course_sale", tx)
		if err != nil {
			return err
		}

		// Credit course owner wallet (net amount)
		purchaseUUID := purchase.ID
		if _, err := CreditWallet(tx, targetWallet.ID, feeResult.NetAmount,
			model.LedgerReasonCourseSale, "course_purchase", &purchaseUUID,
			fmt.Sprintf("Penjualan kursus: %s", course.Title)); err != nil {
			return err
		}

		// Credit platform wallet (fee)
		if feeResult.FeeAmount > 0 {
			if _, err := CreditWallet(tx, platformWallet.ID, feeResult.FeeAmount,
				model.LedgerReasonPlatformFee, "course_purchase", &purchaseUUID,
				fmt.Sprintf("Biaya platform kursus: %s", course.Title)); err != nil {
				return err
			}
		}

		log.Info("Confirmed course purchase and distributed revenue",
			zap.Float64("amount", purchase.Amount),
			zap.Float64("mentor_net", feeResult.NetAmount),
			zap.Float64("platform_fee", feeResult.FeeAmount),
			zap.String("target_wallet_id", targetWallet.ID.String()),
		)

		return nil
	})

	if err != nil {
		log.Error("Failed to confirm course purchase transaction", zap.Error(err))
		sendError(c, http.StatusBadRequest, "Gagal mengkonfirmasi pembayaran: "+err.Error(), nil)
		return
	}

	sendSuccess(c, nil, "Pembayaran berhasil! Kursus sudah bisa diakses")
}

// GET /api/lms/courses/:id/purchase-status — check if user has purchased
func (ctrl *LMSController) GetCoursePurchaseStatus(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	var purchase model.CoursePurchase
	if err := db.Where("course_id = ? AND student_id = ? AND status = ?", courseID, userID, model.PurchasePaid).First(&purchase).Error; err != nil {
		sendSuccess(c, gin.H{"purchased": false}, "Purchase status")
		return
	}

	sendSuccess(c, gin.H{"purchased": true, "purchase": purchase}, "Purchase status")
}

// GET /api/lms/my-purchases — list user's purchased courses
func (ctrl *LMSController) ListMyPurchases(c *gin.Context) {
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	var purchases []model.CoursePurchase
	if err := db.Where("student_id = ? AND status = ?", userID, model.PurchasePaid).
		Preload("Course").Preload("Course.CourseCategory").Order("created_at desc").Find(&purchases).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, purchases, "My purchases retrieved")
}

// admin/mentor: POST /api/lms/admin/courses/:id/set-price
func (ctrl *LMSController) SetCoursePrice(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var req struct {
		Price float64 `json:"price" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, "Harga wajib diisi dan harus lebih dari 0", nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	if err := db.Model(&model.Course{}).Where("id = ?", courseID).Update("price", req.Price).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{"price": req.Price}, "Harga kursus berhasil diatur")
}
