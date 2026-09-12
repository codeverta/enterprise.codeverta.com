import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TransactionalAnalyticsReport, type AnalyticsReportRow } from "@/components/reports/TransactionalAnalyticsReport";
import { useCompanies } from "@/context/CompanyContext";
import { buyingApi, dateForInput, type PurchaseInvoice, type PurchaseOrder } from "../api";

export default function PurchaseAnalyticsPage() {
  const { activeCompany, recordCompanySelection } = useCompanies();
  const [rows, setRows] = useState<AnalyticsReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orders, invoices] = await Promise.all([buyingApi.list({ page_size: 100 }), buyingApi.invoiceList({ page_size: 100 })]);
      const orderRows: AnalyticsReportRow[] = (orders.data || []).flatMap((order: PurchaseOrder) => (order.items || []).map((item, index) => ({ id: `po-${order.id}-${index}`, date: dateForInput(order.transaction_date), voucher: order.number || order.id || "Purchase Order", party: order.supplier, company: order.company, costCenter: order.cost_center, warehouse: item.target_warehouse || order.set_warehouse, itemCode: item.item_code, itemName: item.item_name || item.item_code, quantity: Number(item.quantity) || 0, rate: Number(item.rate) || 0, amount: Number(item.amount) || 0, source: "Purchase Order" })));
      const invoiceRows: AnalyticsReportRow[] = (invoices.data || []).flatMap((invoice: PurchaseInvoice) => (invoice.items || []).map((item, index) => ({ id: `pi-${invoice.id}-${index}`, date: dateForInput(invoice.posting_date), voucher: invoice.number || invoice.id || "Purchase Invoice", party: invoice.supplier, company: invoice.company, costCenter: invoice.cost_center, warehouse: item.warehouse, itemCode: item.item_code, itemName: item.item_name || item.item_code, quantity: Number(item.accepted_qty) || 0, rate: Number(item.rate) || 0, amount: Number(item.amount) || 0, source: "Purchase Invoice" })));
      setRows([...orderRows, ...invoiceRows]);
    } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal memuat Purchase Analytics"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <TransactionalAnalyticsReport moduleLabel="Buying" title="Purchase Analytics" description="Telusuri pembelian per item dan cocokkan dengan dokumen sumber." partyLabel="Supplier" rows={rows} loading={loading} onRefresh={load} initialCompany={activeCompany?.name} onCompanySelected={(company) => void recordCompanySelection(company)} />;
}
