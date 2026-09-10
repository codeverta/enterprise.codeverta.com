package doctype

import (
	"context"
	"fmt"
	"strings"

	coremodel "gin-template/model"

	"gorm.io/gorm"
)

type Document interface {
	DocumentBase() *coremodel.BaseDocument
}

type Hook func(context.Context, *gorm.DB, Document) error

type Definition struct {
	Name          string
	Model         any
	New           func() Document
	NewCollection func() any
	SearchFields  []string
	IsSubmittable bool
	SetDefaults   Hook
	Validate      Hook
	BeforeSave    Hook
	AfterSave     Hook
	BeforeSubmit  Hook
	AfterSubmit   Hook
	BeforeCancel  Hook
	AfterCancel   Hook
	BeforeAmend   Hook
	AfterAmend    Hook
	Naming        func(context.Context, *gorm.DB, Document) (string, error)
}

func DefinitionFor[T any](name string, configure func(*Definition)) Definition {
	definition := Definition{
		Name:          strings.TrimSpace(name),
		Model:         new(T),
		NewCollection: func() any { return &[]T{} },
		New: func() Document {
			document, ok := any(new(T)).(Document)
			if !ok {
				panic(fmt.Sprintf("DocType %s must embed model.BaseDocument", name))
			}
			return document
		},
	}
	if configure != nil {
		configure(&definition)
	}
	return definition
}

func (definition Definition) ValidateDefinition() error {
	if definition.Name == "" || definition.Model == nil || definition.New == nil || definition.NewCollection == nil {
		return fmt.Errorf("doctype definition requires Name, Model, New, and NewCollection")
	}
	if definition.New().DocumentBase() == nil {
		return fmt.Errorf("doctype %s does not provide BaseDocument", definition.Name)
	}
	for _, field := range definition.SearchFields {
		if field == "" || strings.ContainsAny(field, " ;,()") {
			return fmt.Errorf("doctype %s has unsafe search field %q", definition.Name, field)
		}
	}
	return nil
}
