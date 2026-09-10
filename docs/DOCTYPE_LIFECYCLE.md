# Reusable DocType Lifecycle

Framework ini memberi setiap dokumen bisnis alur yang konsisten:

`Draft (0) -> Submitted (1) -> Cancelled (2) -> Amend menjadi Draft baru`

Setiap perubahan disimpan sebagai snapshot revisi. Update draft memakai nomor versi, sehingga perubahan dari dua browser tidak saling menimpa tanpa peringatan.

## 1. Buat model

Embed `model.BaseDocument`, lalu tambahkan field bisnis seperti biasa.

```go
package model

import coremodel "gin-template/model"

type ExpenseClaim struct {
    coremodel.BaseDocument
    EmployeeID string  `gorm:"size:64;not null;index" json:"employee_id"`
    Total      float64 `gorm:"not null" json:"total"`
    Notes      string  `gorm:"type:text" json:"notes"`
}
```

## 2. Daftarkan sekali

Letakkan registrasi di package module yang sudah di-import aplikasi. Setelah itu migration tabel dan seluruh route lifecycle dibuat otomatis.

```go
package expenses

import (
    "context"
    "fmt"

    expensemodel "gin-template/modules/expenses/model"
    framework "gin-template/modules/framework"
    "gin-template/modules/framework/doctype"

    "gorm.io/gorm"
)

func init() {
    framework.RegisterDocument[expensemodel.ExpenseClaim]("Expense Claim", func(def *doctype.Definition) {
        def.IsSubmittable = true
        def.SearchFields = []string{"document_no", "employee_id", "notes"}

        def.Naming = func(_ context.Context, _ *gorm.DB, _ doctype.Document) (string, error) {
            return nextExpenseClaimNumber(), nil
        }

        def.Validate = func(_ context.Context, _ *gorm.DB, document doctype.Document) error {
            claim := document.(*expensemodel.ExpenseClaim)
            if claim.EmployeeID == "" || claim.Total <= 0 {
                return fmt.Errorf("employee dan total wajib diisi")
            }
            return nil
        }

        def.AfterSubmit = postExpenseToLedger
        def.BeforeCancel = reverseExpenseFromLedger
    })
}
```

Hook yang tersedia: `SetDefaults`, `Validate`, `BeforeSave`, `AfterSave`, `BeforeSubmit`, `AfterSubmit`, `BeforeCancel`, `AfterCancel`, `BeforeAmend`, dan `AfterAmend`. Semua hook berjalan dalam transaksi database yang sama; error otomatis membatalkan seluruh operasi.

## 3. Pakai di halaman React

```tsx
const form = useDocTypeDocument<ExpenseClaim>({
  doctype: 'Expense Claim',
  id: params.id,
  initialDocument: () => ({ employee_id: '', total: 0 }),
  onAmended: (document) => navigate(`/desk/expense-claim/${document.id}`),
})

<Input
  value={form.document.notes ?? ''}
  disabled={form.document.doc_status !== 0}
  onChange={(event) => form.setDocument({ notes: event.target.value })}
/>

<DocumentActionBar
  document={form.document}
  dirty={form.dirty}
  action={form.action}
  onSave={form.save}
  onSubmit={form.submit}
  onCancel={form.cancel}
  onAmend={form.amend}
/>
```

Import reusable frontend:

```tsx
import { DocumentActionBar } from '@/components/doctype/document-action-bar'
import { useDocTypeDocument } from '@/hooks/use-doctype-document'
import type { BaseDocument } from '@/lib/doctype'
```

Untuk halaman list atau integrasi khusus, gunakan `createDocTypeClient<T>(doctype)` secara langsung.

## Route otomatis

| Perintah | Endpoint |
| --- | --- |
| List | `GET /api/doctype/:doctype` |
| Detail | `GET /api/doctype/:doctype/:id` |
| Buat draft | `POST /api/doctype/:doctype` |
| Simpan draft | `PUT /api/doctype/:doctype/:id` |
| Submit | `POST /api/doctype/:doctype/:id/submit` |
| Cancel | `POST /api/doctype/:doctype/:id/cancel` |
| Amend | `POST /api/doctype/:doctype/:id/amend` |
| Riwayat | `GET /api/doctype/:doctype/:id/revisions` |

Dokumen Submitted tidak dapat diedit. Dokumen Cancelled juga tetap immutable; Amend membuat record Draft baru, mengisi `amended_from`, menaikkan `amendment_no`, dan mempertahankan dokumen lama untuk audit.
