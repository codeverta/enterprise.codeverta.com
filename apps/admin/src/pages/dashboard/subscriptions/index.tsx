import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import DashboardLayout from "@/layout/DashboardLayout";
import { ResourcePanel } from "@/components/lms/GenericResourcePanel";
import { lmsConfigs, resources } from "@/lib/lms-resource";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Tags,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import api from "@/lib/api";
import { toast } from "sonner";
import dayjs from "dayjs";
import PricingPanel from "@/components/subscriptions/PricingPanel";
import PaymentsPanel from "@/components/subscriptions/PaymentsPanel";
import StatusBadge from "@/components/subscriptions/StatusBadge";
import SubscriptionPanel from "@/components/subscriptions/SubscriptionPanel";







// ─── Page ─────────────────────────────────────────────────────────────────────

function SubscriptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "pricing-settings";

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          Langganan & Transaksi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat paket pemula, anak-anak, dan dewasa, lalu pantau subscription
          serta pembayaran Xendit.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })} className="gap-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="h-auto w-max rounded-md bg-white p-1 shadow-sm">
            <TabsTrigger value="pricing-settings" className="px-4 py-2">
              <CreditCard className="mr-1.5 size-4" /> Paket Langganan
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="px-4 py-2">
              <Users className="mr-1.5 size-4" /> Subscriptions
            </TabsTrigger>
            <TabsTrigger value="payments" className="px-4 py-2">
              <TrendingUp className="mr-1.5 size-4" /> Payments
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pricing-settings">
          <PricingPanel />
        </TabsContent>
        <TabsContent value="subscriptions">
          <SubscriptionPanel />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DashboardLayout(SubscriptionsPage);
