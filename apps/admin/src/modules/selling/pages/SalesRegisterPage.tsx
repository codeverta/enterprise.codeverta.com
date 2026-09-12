import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TransactionalAnalyticsReport, type AnalyticsReportRow } from "@/components/reports/TransactionalAnalyticsReport";
import { useCompanies } from "@/context/CompanyContext";
import { posApi, type POSInvoice } from "../posApi";

const today = () => new Date().toISOString().slice(0, 10);
const cachedOrders = (): any[] => { try { return Object.values(JSON.parse(localStorage.getItem("erp.sales-orders.details") || "{}")); } catch { return []; } };

export default function SalesRegisterPage() {
  const { activeCompany, recordCompanySelection } = useCompanies();
  const [rows, setRows] = useState<AnalyticsReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invoices, catalog] = await Promise.all([posApi.listInvoices(), posApi.listItems()]);
      const itemMap = new Map(catalog.map((item) => [item.item_code, item]));
      const invoiceRows: AnalyticsReportRow[] = invoices.flatMap((invoice: POSInvoice) => invoice.items.map((item, index) => { const master = itemMap.get(item.item_code); return { id: `${invoice.id || invoice.invoice_number}-${index}`, date: (invoice.created_at || today()).slice(0, 10), voucher: invoice.invoice_number || invoice.id || "POS Invoice", party: invoice.customer || "Walk-in Customer", company: invoice.company || "", payment: invoice.mode_of_payment || "", itemGroup: master?.item_group || "", itemCode: item.item_code, itemName: item.item_name || master?.item_name || item.item_code, quantity: Number(item.quantity) || 0, rate: Number(item.rate) || 0, amount: Number(item.amount ?? item.quantity * item.rate) || 0, source: "Sales Invoice" }; }));
      const orderRows: AnalyticsReportRow[] = cachedOrders().flatMap((order) => (order.items || []).map((item: any, index: number) => ({ id: `${order.id}-${index}`, date: String(order.transaction_date || today()).slice(0, 10), voucher: order.order_number || order.id || "Sales Order", party: order.customer || "", partyGroup: order.customer_group || "", company: order.company || "", owner: order.owner || "", costCenter: order.cost_center || "", warehouse: item.target_warehouse || order.set_warehouse || "", brand: item.brand || "", itemGroup: item.item_group || "", itemCode: item.item_code || "", itemName: item.item_name || item.item_code || "", quantity: Number(item.quantity) || 0, rate: Number(item.rate) || 0, amount: Number(item.amount ?? (item.quantity || 0) * (item.rate || 0)) || 0, source: "Sales Order" })));
      setRows([...invoiceRows, ...orderRows]);
    } catch (error: any) { toast.error(error?.response?.data?.error || "Gagal memuat Sales Register"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <TransactionalAnalyticsReport moduleLabel="Selling" title="Sales Register" description="Telusuri penjualan per item dan cocokkan dengan transaksi sumber." partyLabel="Customer" rows={rows} loading={loading} onRefresh={load} initialCompany={activeCompany?.name} onCompanySelected={(company) => void recordCompanySelection(company)} />;
}
