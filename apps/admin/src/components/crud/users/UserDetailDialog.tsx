import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Ban, Power, PlusCircle, Trash2, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";
import { toast } from "sonner";


function InfoRow({ label, value }) {
  return (
    <div className="grid gap-1 rounded-md border bg-muted/20 p-3 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="break-words font-medium text-foreground">
        {value || "-"}
      </span>
    </div>
  );
}




function UserDetailDialog({
    detailOpen,
    setDetailOpen,
    userDetail,
    detailLoading,
    refreshUserDetail,
    onRefresh,
    statusBadge,
    paymentStatusBadge,
    formatDateTime,
    formatDate,
    formatCurrency,
    auditLogs,
    CopyableText,
    openUserDetail,
}: any) {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [submittingSub, setSubmittingSub] = useState<boolean>(false);
  const [removingSub, setRemovingSub] = useState<boolean>(false);

  const handleRefresh = () => {
    if (typeof onRefresh === "function") onRefresh();
    if (typeof refreshUserDetail === "function") refreshUserDetail();
  };

  useEffect(() => {
    if (detailOpen) {
      api.get("/subscription-plans")
        .then((res: any) => {
          const list = res.data?.data || res.data || [];
          setPlans(list);
          if (list.length > 0) {
            setSelectedPlanId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [detailOpen]);

  const handleAssignSubscription = async () => {
    const userId = userDetail?.account?.id;
    if (!userId) return;
    setSubmittingSub(true);
    try {
      await api.post(`/users/${userId}/subscription`, {
        plan_id: selectedPlanId,
        duration_days: Number(durationDays),
      });
      toast.success("Subscription berhasil ditambahkan!");
      handleRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menambahkan subscription");
    } finally {
      setSubmittingSub(false);
    }
  };

  const handleRemoveSubscription = async () => {
    const userId = userDetail?.account?.id;
    if (!userId) return;
    if (!confirm("Apakah Anda yakin ingin menghapus / membatalkan subscription user ini?")) return;
    setRemovingSub(true);
    try {
      await api.delete(`/users/${userId}/subscription`);
      toast.success("Subscription berhasil dihapus!");
      handleRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus subscription");
    } finally {
      setRemovingSub(false);
    }
  };
  return (
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="w-full !max-w-5xl max-h-[90vh] flex flex-col p-0">
        {" "}
        <DialogHeader className="border-b p-6">
          {detailLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <DialogTitle>Memuat detail user...</DialogTitle>
            </div>
          ) : userDetail?.account ? (
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <DialogTitle className="text-2xl">
                  {userDetail.account.full_name || userDetail.account.email}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {userDetail.account.email || "-"} · ID {userDetail.account.id}
                </DialogDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {userDetail.account.role_name}
                  </Badge>
                  {statusBadge(userDetail.account.status)}
                </div>
              </div>
            </div>
          ) : (
            <DialogTitle>User Detail</DialogTitle>
          )}
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {detailLoading ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !userDetail?.account ? (
              <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                Detail user tidak tersedia.
              </div>
            ) : (
              <Tabs defaultValue="overview" className="space-y-5">
                <TabsList className="flex h-auto w-full flex-wrap justify-start">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="subscription">Subscription</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="family">Family</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Account Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <InfoRow
                        label="Full Name"
                        value={userDetail.account.full_name}
                      />
                      <InfoRow label="Email" value={userDetail.account.email} />
                      <InfoRow
                        label="Phone / WhatsApp"
                        value={userDetail.account.phone_number}
                      />
                      <InfoRow
                        label="Role Name"
                        value={userDetail.account.role_name}
                      />
                      <InfoRow
                        label="Account Status"
                        value={
                          userDetail.account.status === 2
                            ? "Inactive"
                            : userDetail.account.status === 3
                            ? "Pending"
                            : "Active"
                        }
                      />
                      <InfoRow
                        label="Created Date"
                        value={formatDateTime(userDetail.account.created_at)}
                      />
                      <InfoRow
                        label="Updated Date"
                        value={formatDateTime(userDetail.account.updated_at)}
                      />
                      <InfoRow
                        label="Last Login"
                        value={formatDateTime(userDetail.account.last_login)}
                      />
                    </CardContent>
                  </Card>
                  {Number(userDetail.account.role) === 20 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Student Information</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <InfoRow
                          label="Full Name"
                          value={userDetail.profile?.full_name}
                        />
                        <InfoRow
                          label="Mother’s Name"
                          value={userDetail.profile?.mother_name}
                        />
                        <InfoRow
                          label="NISN"
                          value={userDetail.profile?.nisn}
                        />
                        <InfoRow
                          label="Student Email"
                          value={userDetail.profile?.student_email}
                        />
                        <InfoRow
                          label="WhatsApp Number"
                          value={userDetail.profile?.whatsapp}
                        />
                        <InfoRow
                          label="Date of Birth"
                          value={formatDate(userDetail.profile?.date_of_birth)}
                        />
                        <InfoRow
                          label="Gender"
                          value={userDetail.profile?.gender}
                        />
                        <InfoRow
                          label="Address"
                          value={userDetail.profile?.address}
                        />
                      </CardContent>
                    </Card>
                  )}
                  {Number(userDetail.account.role) === 40 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Profil Guru Eksternal</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <InfoRow label="Kota" value={userDetail.profile?.city} />
                        <InfoRow label="Institusi" value={userDetail.profile?.institution} />
                        <InfoRow label="Status Mengajar" value={userDetail.profile?.teaching_status} />
                        <InfoRow label="SIMPKB" value={userDetail.profile?.simpkb} />
                        <InfoRow label="NUPTK" value={userDetail.profile?.nuptk} />
                        <InfoRow label="Nomor GTK" value={userDetail.profile?.gtk} />
                        <InfoRow
                          label="Deklarasi Data"
                          value={userDetail.profile?.declaration ? "Disetujui" : "Belum disetujui"}
                        />
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="subscription" className="space-y-5">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                      <div>
                        <CardTitle className="text-base font-bold">Status Subscription Saat Ini</CardTitle>
                        <CardDescription className="text-xs">Informasi paket berlangganan user</CardDescription>
                      </div>
                      {userDetail.subscription?.is_active && (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={removingSub}
                          onClick={handleRemoveSubscription}
                          className="h-8 gap-1.5 text-xs"
                        >
                          {removingSub ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Hapus / Batalkan Subscription
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {userDetail.subscription?.status === "none" || !userDetail.subscription?.is_active ? (
                        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground bg-zinc-50/50">
                          <p className="font-semibold text-zinc-700">User tidak memiliki subscription aktif saat ini.</p>
                          <p className="text-xs mt-1 text-zinc-400">Gunakan opsi di bawah untuk menambahkan subscription bagi user ini.</p>
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <InfoRow
                            label="Current Plan"
                            value={userDetail.subscription?.current_plan}
                          />
                          <InfoRow
                            label="Subscription Status"
                            value={String(
                              userDetail.subscription?.status || "-"
                            )}
                          />
                          <InfoRow
                            label="Start Date"
                            value={formatDateTime(
                              userDetail.subscription?.start_date
                            )}
                          />
                          <InfoRow
                            label="Expiry Date"
                            value={formatDateTime(
                              userDetail.subscription?.expiry_date
                            )}
                          />
                          <InfoRow
                            label="Remaining Days"
                            value={
                              userDetail.subscription?.remaining_days != null
                                ? `${userDetail.subscription.remaining_days} hari`
                                : "-"
                            }
                          />
                          <InfoRow
                            label="Is Active"
                            value={
                              userDetail.subscription?.is_active ? "Ya" : "Tidak"
                            }
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-indigo-100 bg-indigo-50/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-600" />
                        <CardTitle className="text-base font-bold text-zinc-900">
                          Assign / Tambahkan Subscription (Fitur Admin)
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs text-zinc-500">
                        Tambahkan atau perpanjang akses paket subscription untuk user ini jika habis atau membutuhkan penyesuaian khusus.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-zinc-700">Pilih Paket Subscription</Label>
                          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                            <SelectTrigger className="bg-white text-xs">
                              <SelectValue placeholder="Pilih paket..." />
                            </SelectTrigger>
                            <SelectContent>
                              {plans.length === 0 ? (
                                <SelectItem value="default" className="text-xs">Paket Standar Akses Penuh</SelectItem>
                              ) : (
                                plans.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.name} {p.amount ? `(Rp ${p.amount.toLocaleString()})` : ""}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-zinc-700">Durasi Berlangganan</Label>
                          <Select value={String(durationDays)} onValueChange={(val) => setDurationDays(Number(val))}>
                            <SelectTrigger className="bg-white text-xs">
                              <SelectValue placeholder="Pilih durasi..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7" className="text-xs">7 Hari (Trial)</SelectItem>
                              <SelectItem value="30" className="text-xs">30 Hari (1 Bulan)</SelectItem>
                              <SelectItem value="90" className="text-xs">90 Hari (3 Bulan)</SelectItem>
                              <SelectItem value="180" className="text-xs">180 Hari (6 Bulan)</SelectItem>
                              <SelectItem value="365" className="text-xs">365 Hari (1 Tahun)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        {userDetail.subscription?.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={removingSub}
                            onClick={handleRemoveSubscription}
                            className="text-xs text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                          >
                            {removingSub ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                            Hapus Subscription
                          </Button>
                        )}
                        <Button
                          size="sm"
                          disabled={submittingSub}
                          onClick={handleAssignSubscription}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                        >
                          {submittingSub ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="mr-1.5 h-3.5 w-3.5" />}
                          Assign / Tambahkan Subscription
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="payments">
                  <Card>
                    <CardHeader>
                      <CardTitle>Payment History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!userDetail.payments?.length ? (
                        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                          No payment history found.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Payment ID</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Paid At</TableHead>
                                <TableHead>Paid For Student</TableHead>
                                <TableHead>Payer</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {userDetail.payments.map((payment) => (
                                <TableRow key={payment.id}>
                                  <TableCell className="max-w-[180px] truncate font-mono text-xs">
                                    <CopyableText id={payment.id} />
                                  </TableCell>
                                  <TableCell>
                                    {payment.plan_name || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {formatCurrency(
                                      payment.total_amount || payment.amount
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {paymentStatusBadge(payment.status)}
                                  </TableCell>
                                  <TableCell>
                                    {payment.payment_type || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {formatDateTime(payment.paid_at)}
                                  </TableCell>
                                  <TableCell>
                                    {payment.target_student_name ||
                                      payment.student_id ||
                                      "-"}
                                  </TableCell>
                                  <TableCell>
                                    {payment.payer_name ||
                                      payment.parent_id ||
                                      "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="family" className="space-y-4">
                  {Number(userDetail.account.role) === 10 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Linked Children</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!userDetail.children?.length ? (
                          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                            No linked children found.
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {userDetail.children.map((child) => (
                              <div
                                key={child.student_id}
                                className="rounded-lg border p-4"
                              >
                                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                                  <div>
                                    <p className="font-semibold">
                                      {child.full_name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {child.email || "-"} ·{" "}
                                      {child.phone_number || "-"}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      ID: {child.student_id}
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      openUserDetail(child.student_id)
                                    }
                                  >
                                    View Child Detail
                                  </Button>
                                </div>
                                <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                                  <InfoRow label="NISN" value={child.nisn} />
                                  <InfoRow
                                    label="Subscription Status"
                                    value={String(
                                      child.subscription_status || "-"
                                    )}
                                  />
                                  <InfoRow
                                    label="Subscription Expiry"
                                    value={formatDateTime(
                                      child.subscription_expiry
                                    )}
                                  />
                                  <InfoRow
                                    label="Last Activity"
                                    value={formatDateTime(child.last_activity)}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {Number(userDetail.account.role) === 20 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Linked Parent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!userDetail.parents?.length ? (
                          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                            No linked parent found.
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {userDetail.parents.map((parent) => (
                              <div
                                key={parent.parent_id}
                                className="rounded-lg border p-4"
                              >
                                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                                  <div>
                                    <p className="font-semibold">
                                      {parent.parent_name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {parent.parent_email || "-"} ·{" "}
                                      {parent.parent_whatsapp || "-"}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      ID: {parent.parent_id}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Relationship:{" "}
                                      {parent.relationship_type || "parent"}
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      openUserDetail(parent.parent_id)
                                    }
                                  >
                                    View Parent Detail
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {![10, 20].includes(Number(userDetail.account.role)) && (
                    <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                      No family information available for this user role.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity">
                  <Card>
                    <CardHeader>
                      <CardTitle>Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {auditLogs.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                          Last login:{" "}
                          <strong>
                            {formatDateTime(userDetail.account.last_login)}
                          </strong>
                          <br />
                          <br />
                          Belum ada aktivitas audit untuk user ini.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {auditLogs.map((log: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                            >
                              <Badge
                                variant="outline"
                                className="shrink-0 text-[10px]"
                              >
                                {log.action || log.event || "unknown"}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">
                                  {log.description || log.message || ""}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatDateTime(log.created_at)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default UserDetailDialog
