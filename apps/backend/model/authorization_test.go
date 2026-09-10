package model

import "testing"

func TestDefaultAuthorizationRoles(t *testing.T) {
	if len(defaultRoleNames) != 50 {
		t.Fatalf("expected 48 ERP roles plus Admin and Super Admin, got %d", len(defaultRoleNames))
	}
	seen := map[string]bool{}
	for _, name := range defaultRoleNames {
		if seen[name] {
			t.Fatalf("duplicate default role %q", name)
		}
		seen[name] = true
	}
	for _, required := range []string{"Administrator", "System Manager", "Admin", "Super Admin", "Guest", "All"} {
		if !seen[required] {
			t.Fatalf("missing default role %q", required)
		}
	}
}

func TestResourcePermissionMatching(t *testing.T) {
	cases := []struct {
		rule, resource string
		match          bool
	}{
		{"*", "/api/buying/suppliers", true},
		{"/api/buying/*", "/api/buying/suppliers", true},
		{"/desk/supplier", "/desk/supplier", true},
		{"/desk/supplier", "/desk/item", false},
	}
	for _, test := range cases {
		if actual := resourceMatches(test.rule, test.resource); actual != test.match {
			t.Errorf("resourceMatches(%q, %q)=%v", test.rule, test.resource, actual)
		}
	}
}

func TestRoleDefinitionFieldsAndSync(t *testing.T) {
	r := &RoleDefinition{
		RoleName: "Custom Inspector",
		Disabled: true,
	}
	if err := r.BeforeCreate(nil); err != nil {
		t.Fatalf("BeforeCreate error: %v", err)
	}
	if r.Name != "Custom Inspector" {
		t.Fatalf("expected Name to sync from RoleName, got %q", r.Name)
	}
	if r.Enabled != false {
		t.Fatalf("expected Enabled to be false when Disabled is true")
	}

	r2 := &RoleDefinition{
		Name:     "Another Role",
		Disabled: false,
	}
	if err := r2.BeforeSave(nil); err != nil {
		t.Fatalf("BeforeSave error: %v", err)
	}
	if r2.RoleName != "Another Role" {
		t.Fatalf("expected RoleName to sync from Name, got %q", r2.RoleName)
	}
	if r2.Enabled != true {
		t.Fatalf("expected Enabled to be true when Disabled is false")
	}
}
