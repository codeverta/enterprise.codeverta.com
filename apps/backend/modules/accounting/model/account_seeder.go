package model

import (
	"bufio"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CompanySeedInput struct {
	ID           string
	TenantID     string
	Name         string
	Abbreviation string
	Currency     string
}

type accountSeedNode struct {
	number string
	name   string
	parent string
}

// defaultChartOfAccounts is the Indonesian chart supplied for Accounts Setup.
// Parent nodes are derived from the numbering hierarchy, so the template stays
// readable and can be reused for every company.
const defaultChartOfAccounts = `
1000.000|Aktiva
1100.000|Aktiva Lancar
1110.000|Kas
1111.000|Kas Rupiah
1111.001|Kas Kecil
1111.002|Kas Besar
1112.000|Kas Mata Uang Lain
1112.001|Kas USD
1120.000|Bank
1121.000|Bank Rupiah
1121.001|Bank Mandiri - Rekening {{company}}
1121.002|Xendit - Saldo Penampung
1122.000|Bank Other Currency
1130.000|Piutang
1131.000|Piutang Dagang
1131.0010|Piutang Dagang
1132.000|Piutang Lain lain
1132.001|Piutang Lain-lain 1
1140.000|Persediaan Barang
1141.000|Persediaan Barang
1142.000|Uang Muka Pembelian
1142.001|Uang Muka Pembelian
1150.000|Biaya di Bayar di Muka
1151.000|Biaya di Bayar di Muka
1151.001|Biaya di Bayar di Muka
1152.000|Pajak Dibayar di Muka
1152.001|PPN Masukan
1152.002|PPh 23 Dibayar di Muka
1160.000|Pendapatan Yang Akan di Terima
1161.000|Pendapatan Yang di Terima
1161.001|Pendapatan Yang Akan di Terima
1170.000|Akun sementara
1171.000|Pembukaan sementara
1200.000|Aktiva Tetap
1210.000|Aktiva
1211.000|Aktiva
1211.001|Aktiva
1212.000|Akumulasi Penyusutan Aktiva
1212.001|Akumulasi Penyusutan Aktiva
1230.000|Investasi
1231.000|Investasi
1231.100|Investasi Saham
1231.101|Investasi Saham
1231.200|Investasi Perumahan
1231.201|Investasi Perumahan
1231.300|Deposito
2000.000|Passiva
2100.000|Pasiva Lancar
2110.000|Hutang Dagang
2111.000|Hutang Dagang Rupiah
2111.001|Hutang Dagang Dalam Negeri
2111.002|Hutang Dagang Luar Negeri
2111.003|Hutang Dagang Biaya Kirim Dalam Negeri
2111.004|Hutang Dagang Biaya Kirim Luar Negeri
2112.000|Hutang Dagang Other Currency
2112.001|Hutang Dagang Luar Negeri (USD)
2112.002|Hutang Dagang Luar Negeri (SGD)
2112.003|Hutang Dagang Biaya Kirim Luar Negeri (USD)
2112.004|Hutang Dagang Biaya Kirim Luar Negeri (SGD)
2112.005|Hutang Dagang Biaya Kirim Dalam Negeri
2115.000|Stock Diterima Tapi Tidak Ditagih
2120.000|Pendapatan di Terima di Muka
2121.000|Pendapatan di Terima di Muka
2121.001|DP Penjualan
2130.000|Biaya Yang Akan di Bayar
2131.000|Biaya Yang Akan di Bayar
2131.001|Biaya Yang Akan di Bayar
2131.002|Hutang Gaji Karyawan
2132.000|Biaya Yang Akan di Bayar - Freight
2132.001|Biaya Yang Akan di Bayar - Freight
2140.000|Hutang Pajak
2141.000|Hutang Pajak
2142.000|PPN Keluaran
2141.TAX|Duties and Taxes|2141.000
2141.PPN|PPN Masukan|2141.TAX
2200.000|Passiva Tetap
2210.000|Hutang Pada Pihak ke 3
2211.000|Pinjaman Pihak ke 3 Rutin
2211.001|Hutang
2212.000|Pinjaman Pihak ke 3 Tidak Rutin
2212.001|Hutang
2213.000|Hutang Bunga Pinjaman Pihak Ke 3 Tidak Rutin
2213.001|Hutang Bunga
2220.000|Hutang Pada Bank
2221.000|Hutang Bank
2221.001|Hutang
2230.000|Hutang Leasing Kendaraan
2231.000|Hutang Leasing Kendaraan
2240.000|Hutang Lain Lain
2241.000|Hutang Lain Lain
3000.000|Modal
3100.000|Modal
3110.000|Modal di Setor
3120.000|Prive P.Saham
3130.000|Saldo pembukaan Equity
3200.000|Laba
3210.000|Laba di Tahan
3220.000|Laba Tahun Berjalan
3230.000|Laba Periode Berjalan
4000.000|Penjualan
4100.000|Penjualan Barang Dagangan
4110.000|Penjualan
4120.000|Retur Penjualan
4130.000|Potongan Penjualan
4200.000|Harga Pokok Pembelian
4210.000|HPP Pembelian
4300.000|Pendapatan Service/Jasa
4310.000|Pendapatan Service
4400.000|Pendapatan Lain lain
4410.000|Pendapatan Bunga Bank
4420.000|Pendapatan Bunga Dari Pihak Ke 3
4430.000|Pendapatan Keuntungan Penjualan Aktiva
4440.000|Pendapatan Komisi
4450.000|Pendapatan Sewa Gudang
4460.000|Pendapatan Sewa Lain lain
4470.000|Pendapatan Penjualan Barang BS
4480.000|Pendapatan Lain lain
5000.000|Beban
5100.000|Beban Langsung
5110.000|Beban Penjualan
5110.001|Biaya BBM
5110.002|Biaya Tol
5110.003|Biaya Parkir
5110.004|Biaya Upah Angkat/Turun Barang
5110.005|Biaya Kuli
5110.006|Biaya Perjalanan Dinas
5110.007|Biaya Barang Rusak
5110.008|Biaya Perbaikan Kendaraan Operasional
5110.009|Biaya Asuransi Kendaraan Operasional
5110.010|Biaya Leasing Kendaraan Operasional
5110.011|Biaya Kebutuhan Penjualan
5110.012|Biaya Sample
5110.013|Biaya Bonus, Hadiah, dan Sampel
5110.014|Biaya Entertainment dan Pergaulan
5110.015|Biaya Sewa Gudang
5110.016|Biaya Sewa Peralatan Gudang
5110.017|Biaya Piutang Tak Tertagih
5110.018|Potongan Supplier
5110.019|Biaya Penjualan Lain Lain
5110.020|Penyesuaian Stock
5110.021|Biaya Susut Barang
5120.000|Biaya Gaji & Kesejahteraan Pegawai
5120.001|Biaya Gaji Staff & Karyawan Tetap
5120.002|Biaya Gaji Karyawan Harian
5120.003|Biaya Pengobatan
5120.004|Biaya Asuransi Kesehatan Pegawai
5120.005|Biaya THR, Bonus, dan Komisi
5120.006|Biaya Konsumsi
5120.007|Biaya Gaji & Kesejahteraan Lainnya
5130.000|Biaya Kantor & Gudang
5130.001|Biaya PLN Gudang & Kantor
5130.002|Biaya PAM Gudang & Kantor
5130.003|Biaya TLP Gudang & Kantor
5130.004|Biaya Fotocopy, Photo, Print Out
5130.005|Biaya Alat Tulis Kantor
5130.006|Biaya Stamp Duty & Pos
5130.007|Biaya Servis Peralatan Gudang
5130.008|Biaya Pemeliharaan Bgn Gudang
5130.009|Biaya Humas & Pergaulan
5130.010|Biaya Perlengkapan Gudang
5130.011|Iuran Bulanan
5130.012|Biaya Serba Serbi
5130.013|Biaya Sewa Kantor
5130.014|Biaya Asuransi Bangunan
5130.015|Biaya Sumbangan
5130.016|Biaya Perizinan Usaha dan Bangunan
5130.017|Biaya Perizinan Kendaraan Operasional
5130.018|Biaya KTR & GDG Lain Lain
5200.000|Beban Tidak Langsung
5210.000|Biaya Gaji & Kesejahteraan Pegawai Indirect
5210.001|Biaya Gaji Staff
5210.002|Biaya THR dan Bonus Staff
5210.003|Biaya Pengobatan & Kesehatan
5210.004|Biaya Konsumsi
5210.005|Biaya Gaji Lain Lain
5220.000|Biaya Operational Indirect
5220.001|Biaya BBM
5220.002|Biaya Tol & Parkir
5220.003|Biaya TLP & HP
5220.004|Biaya Perjalanan Dinas
5220.005|Biaya Perbaikan Kendaraan Dinas
5220.006|Biaya Asuransi Kendaraan Dinas
5220.007|Biaya Leasing Kendaraan Dinas
5220.008|Biaya Entertainment dan Pergaulan
5220.009|Biaya Hadiah dan Bonus
5230.000|Biaya Kantor Indirect
5230.001|Biaya PLN Kantor
5230.002|Biaya PAM Kantor
5230.003|Biaya TLP Kantor
5230.004|Biaya Sewa Kantor
5230.005|Biaya Asuransi Bangunan
5230.006|Biaya Alat Tulis Kantor
5230.007|Biaya Fotocopy, Photo, Print Out
5230.008|Biaya Kirim Dokumen
5230.009|Biaya Perlengkapan & Peralatan Kantor
5230.010|Service Peralatan Kantor
5230.011|Biaya Pemeliharaan Bangunan Kantor
5230.012|Biaya Iuran Bulanan
5230.013|Biaya Sumbangan
5230.014|Biaya Perizinan Bangunan
5230.015|Biaya Perizinan Kendaraan Dinas
5230.016|Biaya KTR Lain Lain
5230.017|Biaya Stamp Duty & Pos
5300.000|Biaya Penyusutan
5310.000|Biaya Penyusutan
5310.001|By Peny Aktiva
5400.000|Biaya Amortisasi
5410.000|Biaya Amortisasi
5500.000|Beban Lain lain
5510.000|Beban Lain lain
`

func parseDefaultAccounts() ([]accountSeedNode, error) {
	var nodes []accountSeedNode
	scanner := bufio.NewScanner(strings.NewReader(defaultChartOfAccounts))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) < 2 || len(parts) > 3 {
			return nil, fmt.Errorf("invalid account seed row %q", line)
		}
		node := accountSeedNode{number: strings.TrimSpace(parts[0]), name: strings.TrimSpace(parts[1])}
		if len(parts) == 3 {
			node.parent = strings.TrimSpace(parts[2])
		}
		nodes = append(nodes, node)
	}
	return nodes, scanner.Err()
}

func inferredParent(number string) string {
	parts := strings.Split(number, ".")
	if len(parts) != 2 || len(parts[0]) != 4 {
		return ""
	}
	whole, fraction := parts[0], parts[1]
	if fraction != "000" {
		if number == "1231.101" {
			return "1231.100"
		}
		if number == "1231.201" {
			return "1231.200"
		}
		return whole + ".000"
	}
	if whole[3] != '0' {
		return whole[:3] + "0.000"
	}
	if whole[2] != '0' {
		return whole[:2] + "00.000"
	}
	if whole[1] != '0' {
		return whole[:1] + "000.000"
	}
	return ""
}

func defaultAccountType(number, name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.Contains(lower, "akumulasi penyusutan"):
		return "Accumulated Depreciation"
	case strings.Contains(lower, "kas"):
		return "Cash"
	case strings.Contains(lower, "bank") && strings.HasPrefix(number, "1"):
		return "Bank"
	case strings.Contains(lower, "piutang"):
		return "Receivable"
	case strings.Contains(lower, "persediaan") || strings.Contains(lower, "stock"):
		return "Stock"
	case strings.Contains(lower, "pajak") || strings.Contains(lower, "ppn") || strings.Contains(lower, "duties"):
		return "Tax"
	case strings.HasPrefix(number, "12"):
		return "Fixed Asset"
	case strings.HasPrefix(number, "1"):
		return "Current Asset"
	case strings.Contains(lower, "hutang dagang"):
		return "Payable"
	case strings.HasPrefix(number, "2"):
		return "Current Liability"
	case strings.HasPrefix(number, "3"):
		return "Equity"
	case strings.Contains(lower, "hpp") || strings.Contains(lower, "harga pokok"):
		return "Cost of Goods Sold"
	case strings.HasPrefix(number, "4"):
		return "Income Account"
	case strings.HasPrefix(number, "5"):
		return "Expense Account"
	default:
		return ""
	}
}

func DefaultAccountTemplateCount() int {
	nodes, _ := parseDefaultAccounts()
	return len(nodes)
}

// SeedDefaultAccountsForCompany is idempotent and safe to call during setup,
// upgrades, or immediately after a new company is created.
func SeedDefaultAccountsForCompany(db *gorm.DB, company CompanySeedInput) error {
	if strings.TrimSpace(company.ID) == "" || strings.TrimSpace(company.TenantID) == "" {
		return fmt.Errorf("company and tenant are required to seed accounts")
	}
	nodes, err := parseDefaultAccounts()
	if err != nil {
		return err
	}
	currency := strings.ToUpper(strings.TrimSpace(company.Currency))
	if currency == "" {
		currency = "IDR"
	}
	parentNumbers := map[string]bool{}
	for i := range nodes {
		if nodes[i].parent == "" {
			nodes[i].parent = inferredParent(nodes[i].number)
		}
		if nodes[i].parent != "" {
			parentNumbers[nodes[i].parent] = true
		}
	}
	return db.Transaction(func(tx *gorm.DB) error {
		ids := map[string]string{}
		for _, node := range nodes {
			id := "acc-" + uuid.NewString()[:12]
			name := strings.ReplaceAll(node.name, "{{company}}", company.Name)
			account := Account{
				ID: id, TenantID: company.TenantID, CompanyID: company.ID,
				AccountName: name, AccountNumber: node.number,
				IsGroup: parentNumbers[node.number], AccountType: defaultAccountType(node.number, name),
				AccountCurrency: currency,
			}
			if parentID := ids[node.parent]; parentID != "" {
				account.ParentAccountID = &parentID
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "tenant_id"}, {Name: "company_id"}, {Name: "account_number"}},
				DoNothing: true,
			}).Create(&account).Error; err != nil {
				return err
			}
			var saved Account
			if err := tx.Where("tenant_id = ? AND company_id = ? AND account_number = ?", company.TenantID, company.ID, node.number).First(&saved).Error; err != nil {
				return err
			}
			ids[node.number] = saved.ID
		}
		return nil
	})
}
