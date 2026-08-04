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
