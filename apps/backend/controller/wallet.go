package controller

import (
	"fmt"
	"gin-template/model"
	"math"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ─── Fee Calculation ────────────────────────────────────────────────────────

type FeeResult struct {
	FeeAmount float64
	NetAmount float64
}

// GET /lms/my-wallet — returns the authenticated user's wallet balance
func (ctrl *LMSController) GetMyWallet(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "LMSController"), zap.String("function", "GetMyWallet"))
	userID, role, ok := currentLMSUser(c)
	if !ok {
		log.Warn("Failed to extract current user context")
		return
	}

	db := lmsDB(c, ctrl.DB)

	var wallet *model.Wallet
	var err error

	tenantVal, _ := c.Get("tenantID")
	tenantID, _ := tenantVal.(uuid.UUID)

	log = log.With(zap.String("user_id", userID.String()), zap.Int("role", role), zap.String("tenant_id", tenantID.String()))

	// Mentors (30) and admins (99+) have wallets
	// Students (10, 20) don't
	if role >= 30 && role < 99 {
		wallet, err = EnsureWallet(db, model.WalletOwnerUser, userID, tenantID)
	} else if role >= 99 {
		// Admins/superadmin — use platform wallet
		wallet, err = EnsureWallet(db, model.WalletOwnerPlatform, uuid.Nil, tenantID)
	} else {
		log.Info("Wallet requested by non-eligible role")
		sendSuccess(c, gin.H{
			"wallet":            nil,
			"available_balance": 0,
		}, "Wallet not applicable for this role")
		return
	}

	if err != nil {
		log.Error("Failed to retrieve or ensure wallet", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	log.Info("Successfully retrieved wallet",
		zap.String("wallet_id", wallet.ID.String()),
		zap.Float64("balance", wallet.Balance),
		zap.Float64("available_balance", wallet.GetAvailableBalance()),
	)

	sendSuccess(c, gin.H{
		"wallet":            wallet,
		"available_balance": wallet.GetAvailableBalance(),
	}, "Wallet retrieved")
}

func CalculateFee(grossAmount float64, feeName string, db *gorm.DB) (*FeeResult, error) {
	log := zap.L().With(
		zap.String("function", "CalculateFee"),
		zap.Float64("gross_amount", grossAmount),
		zap.String("fee_name", feeName),
	)

	var cfg model.PlatformFeeConfig
	if err := db.Where("fee_name = ? AND is_active = ?", feeName, true).First(&cfg).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Debug("No active fee config found, returning zero fee")
			return &FeeResult{FeeAmount: 0, NetAmount: grossAmount}, nil
		}
		log.Error("Failed to query platform fee config", zap.Error(err))
		return nil, err
	}

	var fee float64
	switch cfg.FeeType {
	case model.FeePercentage:
		fee = grossAmount * (cfg.FeeValue / 100)
	case model.FeeFixed:
		fee = cfg.FeeValue
	}
	if fee > grossAmount {
		fee = grossAmount
	}

	res := &FeeResult{
		FeeAmount: math.Round(fee*100) / 100,
		NetAmount: math.Round((grossAmount-fee)*100) / 100,
	}

	log.Info("Fee calculated successfully",
		zap.String("fee_type", string(cfg.FeeType)),
		zap.Float64("fee_value", cfg.FeeValue),
		zap.Float64("fee_amount", res.FeeAmount),
		zap.Float64("net_amount", res.NetAmount),
	)

	return res, nil
}

// ─── Wallet Targeting ──────────────────────────────────────────────────────

type WalletTarget struct {
	OwnerType model.WalletOwnerType
	OwnerID   uuid.UUID
}

func ResolveCourseRevenueWallet(db *gorm.DB, course *model.Course) (*WalletTarget, error) {
	log := zap.L().With(
		zap.String("function", "ResolveCourseRevenueWallet"),
		zap.String("course_id", course.ID.String()),
		zap.String("owner_type", course.OwnerType),
	)

	switch course.OwnerType {
	case "internal":
		log.Debug("Resolved internal course to platform wallet")
		return &WalletTarget{
			OwnerType: model.WalletOwnerPlatform,
			OwnerID:   uuid.Nil,
		}, nil
	case "external":
		fallthrough
	default:
		if len(course.Mentors) == 0 {
			err := fmt.Errorf("course %s has no mentors assigned", course.ID)
			log.Warn("Course revenue wallet resolution failed", zap.Error(err))
			return nil, err
		}
		mentorID := course.Mentors[0].ID
		log.Info("Resolved external course to mentor personal wallet", zap.String("mentor_id", mentorID.String()))
		return &WalletTarget{
			OwnerType: model.WalletOwnerUser,
			OwnerID:   mentorID,
		}, nil
	}
}

// ─── Wallet CRUD ──────────────────────────────────────────────────────────

func EnsureWallet(db *gorm.DB, ownerType model.WalletOwnerType, ownerID uuid.UUID, tenantID uuid.UUID) (*model.Wallet, error) {
	log := zap.L().With(
		zap.String("function", "EnsureWallet"),
		zap.String("owner_type", string(ownerType)),
		zap.String("owner_id", ownerID.String()),
		zap.String("tenant_id", tenantID.String()),
	)

	var wallet model.Wallet
	err := db.Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).First(&wallet).Error
	if err == nil {
		log.Debug("Existing wallet found", zap.String("wallet_id", wallet.ID.String()), zap.Float64("balance", wallet.Balance))
		return &wallet, nil
	}
	if err != gorm.ErrRecordNotFound {
		log.Error("Database error checking wallet existence", zap.Error(err))
		return nil, err
	}

	wallet = model.Wallet{
		OwnerType: ownerType,
		OwnerID:   ownerID,
		Balance:   0,
		Currency:  "IDR",
		IsActive:  true,
		TenantID:  tenantID,
	}
	if err := db.Create(&wallet).Error; err != nil {
		log.Error("Failed to create new wallet", zap.Error(err))
		return nil, err
	}

	log.Info("Created new wallet", zap.String("wallet_id", wallet.ID.String()))
	return &wallet, nil
}

// ─── Transactions (atomic) ─────────────────────────────────────────────────

// CreditWallet credits a wallet and creates a ledger entry in a single transaction.
func CreditWallet(db *gorm.DB, walletID uuid.UUID, amount float64, reason model.LedgerReason, referenceType string, referenceID *uuid.UUID, description string) (*model.Wallet, error) {
	refIDStr := ""
	if referenceID != nil {
		refIDStr = referenceID.String()
	}
	log := zap.L().With(
		zap.String("function", "CreditWallet"),
		zap.String("wallet_id", walletID.String()),
		zap.Float64("amount", amount),
		zap.String("reason", string(reason)),
		zap.String("ref_type", referenceType),
		zap.String("ref_id", refIDStr),
	)

	if amount <= 0 {
		err := fmt.Errorf("credit amount must be positive")
		log.Warn("Invalid credit amount", zap.Error(err))
		return nil, err
	}

	var wallet model.Wallet
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Raw("SELECT * FROM wallets WHERE id = ? FOR UPDATE", walletID).Scan(&wallet).Error; err != nil {
			return err
		}
		if wallet.ID == uuid.Nil {
			return gorm.ErrRecordNotFound
		}

		newBalance := wallet.Balance + amount
		ledger := model.WalletLedger{
			WalletID:       wallet.ID,
			Amount:         amount,
			RunningBalance: newBalance,
			EntryType:      model.LedgerCredit,
			Reason:         reason,
			ReferenceType:  referenceType,
			ReferenceID:    referenceID,
			Description:    description,
			TenantID:       wallet.TenantID,
		}
		if err := tx.Create(&ledger).Error; err != nil {
			return err
		}

		return tx.Model(&wallet).Update("balance", newBalance).Error
	})

	if err != nil {
		log.Error("Wallet credit transaction failed", zap.Error(err))
		return nil, err
	}

	log.Info("Wallet credited successfully",
		zap.Float64("previous_balance", wallet.Balance-amount),
		zap.Float64("new_balance", wallet.Balance),
		zap.String("description", description),
	)

	return &wallet, nil
}

// DebitWallet debits a wallet and creates a ledger entry in a single transaction.
func DebitWallet(db *gorm.DB, walletID uuid.UUID, amount float64, reason model.LedgerReason, referenceType string, referenceID *uuid.UUID, description string) (*model.Wallet, error) {
	refIDStr := ""
	if referenceID != nil {
		refIDStr = referenceID.String()
	}
	log := zap.L().With(
		zap.String("function", "DebitWallet"),
		zap.String("wallet_id", walletID.String()),
		zap.Float64("amount", amount),
		zap.String("reason", string(reason)),
		zap.String("ref_type", referenceType),
		zap.String("ref_id", refIDStr),
	)

	if amount <= 0 {
		err := fmt.Errorf("debit amount must be positive")
		log.Warn("Invalid debit amount", zap.Error(err))
		return nil, err
	}

	var wallet model.Wallet
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Raw("SELECT * FROM wallets WHERE id = ? FOR UPDATE", walletID).Scan(&wallet).Error; err != nil {
			return err
		}
		if wallet.ID == uuid.Nil {
			return gorm.ErrRecordNotFound
		}

		available := wallet.Balance - wallet.LockedBalance
		if amount > available {
			return fmt.Errorf("insufficient available balance: have %.2f, need %.2f", available, amount)
		}

		newBalance := wallet.Balance - amount
		ledger := model.WalletLedger{
			WalletID:       wallet.ID,
			Amount:         amount,
			RunningBalance: newBalance,
			EntryType:      model.LedgerDebit,
			Reason:         reason,
			ReferenceType:  referenceType,
			ReferenceID:    referenceID,
			Description:    description,
			TenantID:       wallet.TenantID,
		}
		if err := tx.Create(&ledger).Error; err != nil {
			return err
		}

		return tx.Model(&wallet).Update("balance", newBalance).Error
	})

	if err != nil {
		log.Warn("Wallet debit transaction failed", zap.Error(err))
		return nil, err
	}

	log.Info("Wallet debited successfully",
		zap.Float64("previous_balance", wallet.Balance+amount),
		zap.Float64("new_balance", wallet.Balance),
		zap.String("description", description),
	)

	return &wallet, nil
}

// LockWalletBalance increases locked_balance, preventing withdrawal of that amount.
func LockWalletBalance(db *gorm.DB, walletID uuid.UUID, amount float64, description string) (*model.Wallet, error) {
	log := zap.L().With(
		zap.String("function", "LockWalletBalance"),
		zap.String("wallet_id", walletID.String()),
		zap.Float64("amount", amount),
	)

	if amount <= 0 {
		err := fmt.Errorf("lock amount must be positive")
		log.Warn("Invalid lock amount", zap.Error(err))
		return nil, err
	}

	var wallet model.Wallet
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Raw("SELECT * FROM wallets WHERE id = ? FOR UPDATE", walletID).Scan(&wallet).Error; err != nil {
			return err
		}
		if wallet.ID == uuid.Nil {
			return gorm.ErrRecordNotFound
		}
		available := wallet.Balance - wallet.LockedBalance
		if amount > available {
			return fmt.Errorf("cannot lock %.2f: only %.2f available", amount, available)
		}
		newLocked := wallet.LockedBalance + amount
		ledger := model.WalletLedger{
			WalletID:       wallet.ID,
			Amount:         amount,
			RunningBalance: wallet.Balance,
			EntryType:      model.LedgerCredit,
			Reason:         model.LedgerReasonAdminAdjustment,
			Description:    "LOCK: " + description,
			TenantID:       wallet.TenantID,
		}
		if err := tx.Create(&ledger).Error; err != nil {
			return err
		}
		return tx.Model(&wallet).Update("locked_balance", newLocked).Error
	})

	if err != nil {
		log.Warn("Lock wallet balance failed", zap.Error(err))
		return nil, err
	}

	log.Info("Wallet balance locked successfully",
		zap.Float64("new_locked_balance", wallet.LockedBalance),
		zap.Float64("remaining_available", wallet.GetAvailableBalance()),
	)

	return &wallet, nil
}

// UnlockWalletBalance decreases locked_balance, freeing funds for withdrawal.
func UnlockWalletBalance(db *gorm.DB, walletID uuid.UUID, amount float64, description string) (*model.Wallet, error) {
	log := zap.L().With(
		zap.String("function", "UnlockWalletBalance"),
		zap.String("wallet_id", walletID.String()),
		zap.Float64("amount", amount),
	)

	if amount <= 0 {
		err := fmt.Errorf("unlock amount must be positive")
		log.Warn("Invalid unlock amount", zap.Error(err))
		return nil, err
	}

	var wallet model.Wallet
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Raw("SELECT * FROM wallets WHERE id = ? FOR UPDATE", walletID).Scan(&wallet).Error; err != nil {
			return err
		}
		if wallet.ID == uuid.Nil {
			return gorm.ErrRecordNotFound
		}
		if amount > wallet.LockedBalance {
			return fmt.Errorf("cannot unlock %.2f: only %.2f locked", amount, wallet.LockedBalance)
		}
		newLocked := wallet.LockedBalance - amount
		ledger := model.WalletLedger{
			WalletID:       wallet.ID,
			Amount:         amount,
			RunningBalance: wallet.Balance,
			EntryType:      model.LedgerDebit,
			Reason:         model.LedgerReasonAdminAdjustment,
			Description:    "UNLOCK: " + description,
			TenantID:       wallet.TenantID,
		}
		if err := tx.Create(&ledger).Error; err != nil {
			return err
		}
		return tx.Model(&wallet).Update("locked_balance", newLocked).Error
	})

	if err != nil {
		log.Warn("Unlock wallet balance failed", zap.Error(err))
		return nil, err
	}

	log.Info("Wallet balance unlocked successfully",
		zap.Float64("new_locked_balance", wallet.LockedBalance),
		zap.Float64("new_available_balance", wallet.GetAvailableBalance()),
	)

	return &wallet, nil
}
