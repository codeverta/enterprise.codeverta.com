import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  RefreshCcw,
  ReceiptText,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/api";
import DashboardLayout from "@/layout/DashboardLayout";
import { useLanguage } from "@/context/LanguageContext";

function PaymentListPage() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/payments", {
        params: {
          page: currentPage,
          limit: limit,
          search: searchTerm,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
        },
      });
      const { data, pagination } = response.data;
      setPayments(data || []);
      if (pagination) setTotalPages(pagination.total_pages);
    } catch (error) {
      toast.error(t("payments.toast.load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPayments();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, currentPage, statusFilter]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-500 hover:bg-green-600">PAID</Badge>;
      case "PENDING":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">PENDING</Badge>
        );
      case "EXPIRED":
        return <Badge className="bg-gray-500 hover:bg-gray-600">EXPIRED</Badge>;
      case "FAILED":
        return <Badge className="bg-red-500 hover:bg-red-600">FAILED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8 max-w-screen-2xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("payments.list.title")}
        </h1>
        <p className="text-muted-foreground">{t("payments.list.subtitle")}</p>
      </header>

      <div className="bg-card p-4 rounded-lg mb-6 border shadow-sm">
        <div className="flex flex-col md:flex-row items-end justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto flex-1">
            <div>
              <Label className="text-sm text-gray-600 mb-1" htmlFor="search">
                {t("payments.list.search_label")}
              </Label>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("payments.list.search_placeholder")}
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm text-gray-600 mb-1">
                {t("payments.list.status_label")}
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue
                    placeholder={t("payments.list.status_placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    {t("payments.list.status_all")}
                  </SelectItem>
                  <SelectItem value="PAID">PAID</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                  <SelectItem value="FAILED">FAILED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button variant="outline" onClick={fetchPayments}>
            <RefreshCcw className="mr-2 h-4 w-4" /> {t("payments.list.refresh")}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("payments.list.table.trx_id")}</TableHead>
              <TableHead>{t("payments.list.table.method")}</TableHead>
              <TableHead>{t("payments.list.table.amount")}</TableHead>
              <TableHead>{t("payments.list.table.status")}</TableHead>
              <TableHead className="hidden md:table-cell">
                {t("payments.list.table.date")}
              </TableHead>
              <TableHead className="text-right">
                {t("payments.list.table.action")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32">
                  <div className="flex flex-col justify-center items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>{t("payments.list.loading")}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : payments.length > 0 ? (
              payments.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-medium">
                        {p.transaction_id || "-"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Order: {p.order_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal text-xs">
                      {p.PaymentType || "Gateway"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(p.TotalAmount)}
                  </TableCell>
                  <TableCell>{getStatusBadge(p.Status)}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    <div>
                      {t("payments.list.created_at")}{" "}
                      {dayjs(p.CreatedAt).format("DD MMM YYYY HH:mm")}
                    </div>
                    {p.PaidAt && (
                      <div className="text-green-600">
                        {t("payments.list.paid_at")}{" "}
                        {dayjs(p.PaidAt).format("DD MMM YYYY HH:mm")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.invoice_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(p.invoice_url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-1.5" />{" "}
                        {t("payments.list.pay_invoice")}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32">
                  <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-muted-foreground">
                    {t("payments.list.empty")}
                  </span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between py-4">
        <span className="text-sm text-muted-foreground">
          {t("payments.list.pagination_info")
            .replace("{current}", String(currentPage))
            .replace("{total}", String(totalPages || 1))}
        </span>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || loading}
          >
            {t("payments.list.prev_btn")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage === totalPages || loading || totalPages === 0}
          >
            {t("payments.list.next_btn")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout(PaymentListPage);
