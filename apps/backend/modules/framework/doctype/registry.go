package doctype

import (
	"fmt"
	"sort"
	"strings"
	"sync"

	"gorm.io/gorm"
)

type Registry struct {
	mu          sync.RWMutex
	definitions map[string]Definition
}

func NewRegistry() *Registry { return &Registry{definitions: map[string]Definition{}} }

func normalizeName(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func (registry *Registry) Register(definition Definition) error {
	if err := definition.ValidateDefinition(); err != nil {
		return err
	}
	key := normalizeName(definition.Name)
	registry.mu.Lock()
	defer registry.mu.Unlock()
	if _, exists := registry.definitions[key]; exists {
		return fmt.Errorf("doctype %s is already registered", definition.Name)
	}
	registry.definitions[key] = definition
	return nil
}

func (registry *Registry) MustRegister(definition Definition) {
	if err := registry.Register(definition); err != nil {
		panic(err)
	}
}

func (registry *Registry) Get(name string) (Definition, bool) {
	registry.mu.RLock()
	defer registry.mu.RUnlock()
	definition, exists := registry.definitions[normalizeName(name)]
	return definition, exists
}

func (registry *Registry) Names() []string {
	registry.mu.RLock()
	defer registry.mu.RUnlock()
	names := make([]string, 0, len(registry.definitions))
	for _, definition := range registry.definitions {
		names = append(names, definition.Name)
	}
	sort.Strings(names)
	return names
}

func (registry *Registry) Migrate(db *gorm.DB) error {
	registry.mu.RLock()
	defer registry.mu.RUnlock()
	for _, definition := range registry.definitions {
		if err := db.AutoMigrate(definition.Model); err != nil {
			return fmt.Errorf("migrate doctype %s: %w", definition.Name, err)
		}
	}
	return nil
}
