package doctype

import (
	"context"
	"errors"
	"fmt"
	"testing"

	coremodel "gin-template/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type testApprovalDocument struct {
	coremodel.BaseDocument
	Title  string  `json:"title"`
	Amount float64 `json:"amount"`
}

func (testApprovalDocument) TableName() string { return "test_approval_documents" }

func testDefinition() Definition {
	return DefinitionFor[testApprovalDocument]("Test Approval", func(definition *Definition) {
		definition.IsSubmittable = true
		definition.SearchFields = []string{"document_no", "title"}
		definition.Naming = func(_ context.Context, _ *gorm.DB, _ Document) (string, error) {
			return "TST-0001", nil
		}
		definition.Validate = func(_ context.Context, _ *gorm.DB, document Document) error {
			value := document.(*testApprovalDocument)
			if value.Title == "" || value.Amount <= 0 {
				return fmt.Errorf("title and positive amount are required")
			}
			return nil
		}
	})
}

func TestDocumentLifecycle(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:doctype-lifecycle?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&testApprovalDocument{}, &coremodel.DocumentRevision{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	service, definition := NewService(db), testDefinition()
	document := &testApprovalDocument{Title: "Expense", Amount: 125000}
	if err := service.CreateDraft(context.Background(), definition, "tenant-1", document); err != nil {
		t.Fatalf("create draft: %v", err)
	}
	if document.DocStatus != coremodel.DocStatusDraft || document.Version != 1 || document.DocumentNo != "TST-0001" {
		t.Fatalf("unexpected created document: %+v", document.BaseDocument)
	}

	stale := *document
	document.Amount = 150000
	if err := service.SaveDraft(context.Background(), definition, "tenant-1", document.ID, document); err != nil {
		t.Fatalf("save draft: %v", err)
	}
	if document.Version != 2 {
		t.Fatalf("expected version 2, got %d", document.Version)
	}
	stale.Amount = 175000
	if err := service.SaveDraft(context.Background(), definition, "tenant-1", stale.ID, &stale); !errors.Is(err, ErrVersionConflict) {
		t.Fatalf("expected version conflict, got %v", err)
	}

	submitted, err := service.Submit(context.Background(), definition, "tenant-1", document.ID)
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	if submitted.DocumentBase().DocStatus != coremodel.DocStatusSubmitted || submitted.DocumentBase().Version != 3 {
		t.Fatalf("unexpected submitted state: %+v", submitted.DocumentBase())
	}
	if err := service.SaveDraft(context.Background(), definition, "tenant-1", document.ID, document); !errors.Is(err, ErrNotDraft) {
		t.Fatalf("expected submitted document to be immutable, got %v", err)
	}

	cancelled, err := service.Cancel(context.Background(), definition, "tenant-1", document.ID)
	if err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if cancelled.DocumentBase().DocStatus != coremodel.DocStatusCancelled || cancelled.DocumentBase().Version != 4 {
		t.Fatalf("unexpected cancelled state: %+v", cancelled.DocumentBase())
	}

	amendment, err := service.Amend(context.Background(), definition, "tenant-1", document.ID)
	if err != nil {
		t.Fatalf("amend: %v", err)
	}
	base := amendment.DocumentBase()
	if base.DocStatus != coremodel.DocStatusDraft || base.Version != 1 || base.AmendmentNo != 1 || base.AmendedFrom != document.ID || base.DocumentNo != "TST-0001-1" {
		t.Fatalf("unexpected amendment: %+v", base)
	}

	revisions, err := service.Revisions(context.Background(), definition, "tenant-1", document.ID)
	if err != nil {
		t.Fatalf("revisions: %v", err)
	}
	if len(revisions) != 4 {
		t.Fatalf("expected 4 original revisions, got %d", len(revisions))
	}
	if revisions[0].Action != "cancel" {
		t.Fatalf("expected latest revision cancel, got %s", revisions[0].Action)
	}
}

func TestRegistryRejectsDuplicateAndUnsafeDefinition(t *testing.T) {
	registry := NewRegistry()
	definition := testDefinition()
	if err := registry.Register(definition); err != nil {
		t.Fatalf("register: %v", err)
	}
	if err := registry.Register(definition); err == nil {
		t.Fatal("expected duplicate registration error")
	}
	unsafe := testDefinition()
	unsafe.Name = "Unsafe"
	unsafe.SearchFields = []string{"title; DROP TABLE users"}
	if err := registry.Register(unsafe); err == nil {
		t.Fatal("expected unsafe search field error")
	}
}
