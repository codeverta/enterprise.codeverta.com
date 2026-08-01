# Admin modules

Halaman domain bisnis baru ditempatkan di `src/modules/<module>`. Sebuah module
memiliki API client, layout/navigation, pages, dan entry point sendiri. Router
utama hanya mengimpor entry point module sehingga detail fitur tidak menyebar ke
folder aplikasi umum.
