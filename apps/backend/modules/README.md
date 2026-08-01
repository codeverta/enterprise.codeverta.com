# Backend modules

Setiap domain baru ditempatkan sebagai vertical module agar model, controller,
migrasi, dan route tidak bercampur dengan fitur lain.

```text
modules/<module>/
├── model/       # entity, kalkulasi domain, dan migrasi
├── controller/  # HTTP handlers module
└── module.go    # satu entry point untuk route module
```

Root application hanya memanggil `model.Migrate` dan `RegisterRoutes` milik
module. Buying/Purchase Order adalah implementasi pertama pola ini.
