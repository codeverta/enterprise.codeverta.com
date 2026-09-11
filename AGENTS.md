# AI Agent Guidelines & Architecture Map

## Zero-Overscan Policy (STRICT)
**DO NOT run unbounded, repository-wide searches or file scans.**
- Never run root-level `grep_search` or `find_by_name` without narrow directory paths or specific file patterns.
- Never run entire test suites (e.g., `npm test` across all workspaces or root `go test ./...`) for localized changes.
- Always jump directly to the target module path identified below.

---

## Workspace Map

### Frontend (`apps/admin`)
Base directory: `apps/admin/src/modules/`
Each domain follows: `src/modules/<domain>/` with `pages/`, `components/`, `types/`, `api/`, and `tests`.

| Domain | Directory Path | Key Responsibilities |
|---|---|---|
| **Selling** | `apps/admin/src/modules/selling/` | Quotations, Sales Orders, Sales Invoices, Customer, Pricing Rules, Pricing Logic (`salesOrderLogic.ts`) |
| **Buying** | `apps/admin/src/modules/buying/` | Material Requests, Supplier Quotations, Purchase Orders, Purchase Invoices, Supplier |
| **Stock** | `apps/admin/src/modules/stock/` | Items, Item Prices, Price Lists, Delivery Notes, Purchase Receipts, Stock Entry, Warehouses, UOM |
| **Accounting** | `apps/admin/src/modules/accounting/` | Chart of Accounts, Journal Entries, Payments, Financial Reports |
| **Organization** | `apps/admin/src/modules/organization/` | Company Context, Branches, Departments, Multi-tenant Profiles |
| **CRM** | `apps/admin/src/modules/crm/` | Leads, Opportunities, Customers |
| **HR** | `apps/admin/src/modules/hr/` | Employees, Attendance, Payroll, Leaves |
| **Core / Layout** | `apps/admin/src/modules/core/` | Desk layout, Navigation sidebar, Workspace view |

#### Targeted Frontend Testing
Run only the specific test file using Vitest filter:
```bash
pnpm --filter admin test -- <relative-path-to-test-file>
# Example:
pnpm --filter admin test -- src/modules/selling/pages/SalesOrderPage.test.tsx
```

---

### Backend (`apps/backend`)
Base directory: `apps/backend/modules/`

#### 1. Vertical Modules
Each domain module is self-contained:
```text
modules/<domain>/
├── model/       # Entities, domain logic, and Migrate(db *gorm.DB)
├── controller/  # HTTP request handlers
└── module.go    # Route registration (RegisterRoutes)
```
Available vertical modules:
- `modules/selling/` (Quotation, Sales Order, Sales Invoice, Pricing Rule)
- `modules/buying/` (Material Request, Purchase Order, Purchase Invoice)
- `modules/stock/` (Item, Item Price, Price List, Delivery Note, Warehouse)
- `modules/accounting/` (GL Entry, Journal Entry, Accounts)
- `modules/crm/` (Lead, Opportunity)
- `modules/hr/` (Employee, Payroll)
- `modules/projects/` (Project, Task, Timesheet)
- `modules/printing/` (Print Format, Letterhead)

#### 2. Core Platform & Cross-Cutting
- `apps/backend/model/main.go`: Central `AutoMigrate` registry for core platform models and module `model.Migrate()` delegates.
- `apps/backend/model/app-preference.go`: `UserAppPreference` and `UserCompanyUsage`.
- `apps/backend/model/chat.go`: Chat models and AI usage quotas.
- `apps/backend/controller/organization_controller.go`: Company switching, preference loading (`/api/organization/company-context`).
- `apps/backend/router/`: Central HTTP routing setup (`router.go`).

#### Targeted Backend Testing
Always provide test environment secrets and target the specific package and test name:
```bash
JWT_SECRET=dummy_secret_for_test_12345678901234567890123456789012345678901234567890 \
go test -v ./<package> -run <TestFunctionName>
# Example:
go test -v ./controller -run TestCompanyContextOneUserOnePreference
```

---

## Development Workflow Checklist
1. **Locate directly**: Check the table above for the domain. Open the specific page/controller/model directly.
2. **Never scan 100+ files**: If unsure of symbol location, check the domain's index file or module entry point (`module.go` / `index.ts`), not the entire root repository.
3. **Register new models**:
   - If vertical domain: Add to `modules/<domain>/model/` and call in `Migrate(db)`.
   - If core platform: Add struct to `apps/backend/model/main.go` inside `models := []interface{}{...}`.
