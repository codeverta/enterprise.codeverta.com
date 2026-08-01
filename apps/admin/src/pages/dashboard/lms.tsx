import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileAudio,
  FileText,
  GraduationCap,
  Library,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UsersRound,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/layout/DashboardLayout";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ResourcePanel } from "../../components/lms/GenericResourcePanel";
import { resources } from "../../lib/lms-resource";

function LMSAdminPage() {
  const defaultTab = useMemo(() => resources[0].key, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">LMS Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola course, materi, subscription, payment, user LMS, dan konten landing.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="gap-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="h-auto w-max flex-wrap justify-start rounded-md bg-white p-1 shadow-sm">
            {resources.map((resource) => (
              <TabsTrigger key={resource.key} value={resource.key} className="px-3 py-2">
                {resource.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {resources.map((resource) => (
          <TabsContent key={resource.key} value={resource.key}>
            <ResourcePanel resource={resource} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default DashboardLayout(LMSAdminPage);

