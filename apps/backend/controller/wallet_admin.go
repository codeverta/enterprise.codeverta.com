package controller

import (
	"fmt"
	"gin-template/model"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ─── Wallet Admin Controller ──────────────────────────────────────────────

type WalletAdminController struct {
	DB *gorm.DB
}

func NewWalletAdminController(db *gorm.DB) *WalletAdminController {
	return &WalletAdminController{DB: db}
}

// GET /admin/wallets/:id
func (ctrl *WalletAdminController) GetWalletDetail(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "WalletAdminController"), zap.String("function", "GetWalletDetail"))
	idStr := c.Param("id")
	walletID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn("Invalid wallet ID param", zap.String("raw_id", idStr))
		sendError(c, http.StatusBadRequest, "ID dompet tidak valid", nil)
		return
	}

	log = log.With(zap.String("wallet_id", walletID.String()))
	db := lmsDB(c, ctrl.DB)
	var wallet model.Wallet
	if err := db.First(&wallet, "id = ?", walletID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Warn("Wallet not found")
			sendError(c, http.StatusNotFound, "Dompet tidak ditemukan", nil)
			return
		}
		log.Error("Database error fetching wallet detail", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	// Resolve owner display info
	var ownerName string
	switch wallet.OwnerType {
	case model.WalletOwnerUser:
		var user model.User
		if err := db.Select("display_name, email").First(&user, "id = ?", wallet.OwnerID).Error; err == nil {
			ownerName = user.DisplayName
			if ownerName == "" {
				ownerName = user.Email
			}
		}
	case model.WalletOwnerOrganization:
		var org model.Organization
		if err := db.Select("name").First(&org, "id = ?", wallet.OwnerID).Error; err == nil {
			ownerName = org.Name
		}
	case model.WalletOwnerPlatform:
		ownerName = "Platform"
	}

	log.Info("Retrieved wallet detail",
		zap.String("owner_name", ownerName),
		zap.Float64("balance", wallet.Balance),
		zap.Float64("locked_balance", wallet.LockedBalance),
		zap.Float64("available_balance", wallet.GetAvailableBalance()),
	)

	sendSuccess(c, gin.H{
		"wallet":            wallet,
		"available_balance": wallet.GetAvailableBalance(),
		"owner_name":        ownerName,
	}, "Wallet detail retrieved")
}

// POST /admin/wallets/:id/lock
func (ctrl *WalletAdminController) LockBalance(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "WalletAdminController"), zap.String("function", "LockBalance"))
	idStr := c.Param("id")
	walletID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn("Invalid wallet ID param", zap.String("raw_id", idStr))
		sendError(c, http.StatusBadRequest, "ID dompet tidak valid", nil)
		return
	}

	var req struct {
		Amount      float64 `json:"amount" binding:"required,gt=0"`
		Description string  `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn("Invalid JSON payload for LockBalance", zap.Error(err))
		sendBadRequest(c, "Jumlah wajib diisi dan harus lebih dari 0", nil)
		return
	}

	log = log.With(zap.String("wallet_id", walletID.String()), zap.Float64("amount", req.Amount), zap.String("description", req.Description))

	db := lmsDB(c, ctrl.DB)
	wallet, err := LockWalletAmount(db, walletID.String(), req.Amount, req.Description)
	if err != nil {
		log.Warn("Failed to lock wallet balance", zap.Error(err))
		sendError(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	log.Info("Admin locked wallet balance successfully", zap.Float64("new_locked_balance", wallet.LockedBalance))

	sendSuccess(c, gin.H{
		"wallet":            wallet,
		"available_balance": wallet.GetAvailableBalance(),
	}, "Saldo berhasil dikunci")
}

// POST /admin/wallets/:id/unlock
func (ctrl *WalletAdminController) UnlockBalance(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "WalletAdminController"), zap.String("function", "UnlockBalance"))
	idStr := c.Param("id")
	walletID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn("Invalid wallet ID param", zap.String("raw_id", idStr))
		sendError(c, http.StatusBadRequest, "ID dompet tidak valid", nil)
		return
	}

	var req struct {
		Amount      float64 `json:"amount" binding:"required,gt=0"`
		Description string  `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn("Invalid JSON payload for UnlockBalance", zap.Error(err))
		sendBadRequest(c, "Jumlah wajib diisi dan harus lebih dari 0", nil)
		return
	}

	log = log.With(zap.String("wallet_id", walletID.String()), zap.Float64("amount", req.Amount), zap.String("description", req.Description))

	db := lmsDB(c, ctrl.DB)
	wallet, err := UnlockWalletBalance(db, walletID, req.Amount, req.Description)
	if err != nil {
		log.Warn("Failed to unlock wallet balance", zap.Error(err))
		sendError(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	log.Info("Admin unlocked wallet balance successfully", zap.Float64("new_locked_balance", wallet.LockedBalance))

	sendSuccess(c, gin.H{
		"wallet":            wallet,
		"available_balance": wallet.GetAvailableBalance(),
	}, "Saldo berhasil dibuka")
}

// GET /admin/wallets/:id/ledger
func (ctrl *WalletAdminController) GetLedger(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "WalletAdminController"), zap.String("function", "GetLedger"))
	idStr := c.Param("id")
	walletID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn("Invalid wallet ID param", zap.String("raw_id", idStr))
		sendError(c, http.StatusBadRequest, "ID dompet tidak valid", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit := 50
	offset := (page - 1) * limit

	log = log.With(zap.String("wallet_id", walletID.String()), zap.Int("page", page), zap.Int("limit", limit))

	db := lmsDB(c, ctrl.DB)
	var total int64
	db.Model(&model.WalletLedger{}).Where("wallet_id = ?", walletID).Count(&total)

	var entries []model.WalletLedger
	if err := db.Where("wallet_id = ?", walletID).
		Order("created_at desc").
		Limit(limit).Offset(offset).
		Find(&entries).Error; err != nil {
		log.Error("Failed to fetch wallet ledger entries", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	log.Info("Retrieved wallet ledger entries", zap.Int64("total_entries", total), zap.Int("returned_count", len(entries)))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    entries,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"total_pages": (int(total) + limit - 1) / limit,
		},
	})
}

// ─── Wallet helper HTTP ───────────────────────────────────────────────────

// LockWalletAmount wraps the engine function with UUID parsing for the Gin handler
func LockWalletAmount(db *gorm.DB, walletIDStr string, amount float64, description string) (*model.Wallet, error) {
	walletID, err := uuid.Parse(walletIDStr)
	if err != nil {
		return nil, fmt.Errorf("ID dompet tidak valid")
	}
	return LockWalletBalance(db, walletID, amount, description)
}
