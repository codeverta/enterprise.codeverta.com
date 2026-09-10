package doctype

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	coremodel "gin-template/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrNotFound        = errors.New("document not found")
	ErrNotDraft        = errors.New("only draft documents can be saved or submitted")
	ErrNotSubmitted    = errors.New("only submitted documents can be cancelled")
	ErrNotCancelled    = errors.New("only cancelled documents can be amended")
	ErrNotSubmittable  = errors.New("doctype is not submittable")
	ErrVersionConflict = errors.New("document was updated by another user; reload before saving")
)

type Service struct{ DB *gorm.DB }

func NewService(db *gorm.DB) *Service { return &Service{DB: db} }

func actorID(ctx context.Context) string {
	for _, key := range []any{"id", "user_id"} {
		if value := ctx.Value(key); value != nil {
			return fmt.Sprint(value)
		}
	}
	return ""
}

func runHook(hook Hook, ctx context.Context, db *gorm.DB, document Document) error {
	if hook == nil {
		return nil
	}
	return hook(ctx, db, document)
}

func snapshot(ctx context.Context, tx *gorm.DB, definition Definition, document Document, action string) error {
	data, err := json.Marshal(document)
	if err != nil {
		return err
	}
	base := document.DocumentBase()
	revision := coremodel.DocumentRevision{
		ID:         uuid.NewString(),
		TenantID:   base.TenantID,
		DocType:    definition.Name,
		DocumentID: base.ID,
		Version:    base.Version,
		Action:     action,
		Data:       string(data),
		ActorID:    actorID(ctx),
	}
	return tx.Create(&revision).Error
}

func (service *Service) load(tx *gorm.DB, definition Definition, tenantID, identifier string) (Document, error) {
	document := definition.New()
	err := tx.Where("tenant_id = ? AND (id = ? OR document_no = ?)", tenantID, identifier, identifier).First(document).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	return document, err
}

func (service *Service) CreateDraft(ctx context.Context, definition Definition, tenantID string, document Document) error {
	return service.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		base := document.DocumentBase()
		base.ID = uuid.NewString()
		base.TenantID = tenantID
		base.DocStatus = coremodel.DocStatusDraft
		base.Version = 1
		base.AmendmentNo = 0
		base.AmendedFrom = ""
		base.SubmittedAt, base.CancelledAt = nil, nil
		if err := runHook(definition.SetDefaults, ctx, tx, document); err != nil {
			return err
		}
		if strings.TrimSpace(base.DocumentNo) == "" && definition.Naming != nil {
			name, err := definition.Naming(ctx, tx, document)
			if err != nil {
				return err
			}
			base.DocumentNo = strings.TrimSpace(name)
		}
		if base.DocumentNo == "" {
			base.DocumentNo = base.ID
		}
		base.BaseDocumentNo = base.DocumentNo
		if err := runHook(definition.Validate, ctx, tx, document); err != nil {
			return err
		}
		if err := runHook(definition.BeforeSave, ctx, tx, document); err != nil {
			return err
		}
		if err := tx.Create(document).Error; err != nil {
			return err
		}
		if err := snapshot(ctx, tx, definition, document, "create"); err != nil {
			return err
		}
		return runHook(definition.AfterSave, ctx, tx, document)
	})
}

func (service *Service) SaveDraft(ctx context.Context, definition Definition, tenantID, identifier string, incoming Document) error {
	return service.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := service.load(tx, definition, tenantID, identifier)
		if err != nil {
			return err
		}
		old := *existing.DocumentBase()
		if old.DocStatus != coremodel.DocStatusDraft {
			return ErrNotDraft
		}
		if incoming.DocumentBase().Version != old.Version {
			return ErrVersionConflict
		}
		base := incoming.DocumentBase()
		*base = old
		base.Version = old.Version + 1
		if err := runHook(definition.Validate, ctx, tx, incoming); err != nil {
			return err
		}
		if err := runHook(definition.BeforeSave, ctx, tx, incoming); err != nil {
			return err
		}
		result := tx.Model(existing).Where("tenant_id = ? AND id = ? AND version = ?", tenantID, old.ID, old.Version).Select("*").Updates(incoming)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrVersionConflict
		}
		if err := snapshot(ctx, tx, definition, incoming, "save"); err != nil {
			return err
		}
		return runHook(definition.AfterSave, ctx, tx, incoming)
	})
}

func (service *Service) Submit(ctx context.Context, definition Definition, tenantID, identifier string) (Document, error) {
	if !definition.IsSubmittable {
		return nil, ErrNotSubmittable
	}
	var submitted Document
	err := service.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		document, err := service.load(tx, definition, tenantID, identifier)
		if err != nil {
			return err
		}
		base := document.DocumentBase()
		if base.DocStatus != coremodel.DocStatusDraft {
			return ErrNotDraft
		}
		if err := runHook(definition.Validate, ctx, tx, document); err != nil {
			return err
		}
		if err := runHook(definition.BeforeSubmit, ctx, tx, document); err != nil {
			return err
		}
		oldVersion, now := base.Version, time.Now()
		base.DocStatus, base.Version, base.SubmittedAt = coremodel.DocStatusSubmitted, oldVersion+1, &now
		result := tx.Model(document).Where("tenant_id = ? AND id = ? AND version = ?", tenantID, base.ID, oldVersion).Select("*").Updates(document)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrVersionConflict
		}
		if err := snapshot(ctx, tx, definition, document, "submit"); err != nil {
			return err
		}
		if err := runHook(definition.AfterSubmit, ctx, tx, document); err != nil {
			return err
		}
		submitted = document
		return nil
	})
	return submitted, err
}

func (service *Service) Cancel(ctx context.Context, definition Definition, tenantID, identifier string) (Document, error) {
	if !definition.IsSubmittable {
		return nil, ErrNotSubmittable
	}
	var cancelled Document
	err := service.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		document, err := service.load(tx, definition, tenantID, identifier)
		if err != nil {
			return err
		}
		base := document.DocumentBase()
		if base.DocStatus != coremodel.DocStatusSubmitted {
			return ErrNotSubmitted
		}
		if err := runHook(definition.BeforeCancel, ctx, tx, document); err != nil {
			return err
		}
		oldVersion, now := base.Version, time.Now()
		base.DocStatus, base.Version, base.CancelledAt = coremodel.DocStatusCancelled, oldVersion+1, &now
		result := tx.Model(document).Where("tenant_id = ? AND id = ? AND version = ?", tenantID, base.ID, oldVersion).Select("*").Updates(document)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrVersionConflict
		}
		if err := snapshot(ctx, tx, definition, document, "cancel"); err != nil {
			return err
		}
		if err := runHook(definition.AfterCancel, ctx, tx, document); err != nil {
			return err
		}
		cancelled = document
		return nil
	})
	return cancelled, err
}

func (service *Service) Amend(ctx context.Context, definition Definition, tenantID, identifier string) (Document, error) {
	if !definition.IsSubmittable {
		return nil, ErrNotSubmittable
	}
	var amendment Document
	err := service.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		original, err := service.load(tx, definition, tenantID, identifier)
		if err != nil {
			return err
		}
		originalBase := original.DocumentBase()
		if originalBase.DocStatus != coremodel.DocStatusCancelled {
			return ErrNotCancelled
		}
		encoded, err := json.Marshal(original)
		if err != nil {
			return err
		}
		amendment = definition.New()
		if err := json.Unmarshal(encoded, amendment); err != nil {
			return err
		}
		base := amendment.DocumentBase()
		base.ID = uuid.NewString()
		base.TenantID = tenantID
		base.DocStatus = coremodel.DocStatusDraft
		base.Version = 1
		base.AmendmentNo = originalBase.AmendmentNo + 1
		base.AmendedFrom = originalBase.ID
		base.SubmittedAt, base.CancelledAt = nil, nil
		if base.BaseDocumentNo == "" {
			base.BaseDocumentNo = originalBase.DocumentNo
		}
		base.DocumentNo = fmt.Sprintf("%s-%d", base.BaseDocumentNo, base.AmendmentNo)
		base.CreatedAt, base.UpdatedAt = time.Time{}, time.Time{}
		if err := runHook(definition.BeforeAmend, ctx, tx, amendment); err != nil {
			return err
		}
		if err := tx.Create(amendment).Error; err != nil {
			return err
		}
		if err := snapshot(ctx, tx, definition, amendment, "amend"); err != nil {
			return err
		}
		return runHook(definition.AfterAmend, ctx, tx, amendment)
	})
	return amendment, err
}

func (service *Service) Revisions(ctx context.Context, definition Definition, tenantID, identifier string) ([]coremodel.DocumentRevision, error) {
	document, err := service.load(service.DB.WithContext(ctx), definition, tenantID, identifier)
	if err != nil {
		return nil, err
	}
	var rows []coremodel.DocumentRevision
	err = service.DB.WithContext(ctx).Where("tenant_id = ? AND doc_type = ? AND document_id = ?", tenantID, definition.Name, document.DocumentBase().ID).Order("version desc, created_at desc").Find(&rows).Error
	return rows, err
}
