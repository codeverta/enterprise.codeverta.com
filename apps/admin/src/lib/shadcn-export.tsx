import React, { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ChevronDown,
    ChevronRight,
    MoreHorizontal,
    Waves,
    Mountain,
    Droplets,
    FolderKanban,
    FileText,
    Waypoints,
    LogOut,
    UserCircle,
} from "lucide-react";
import { useNavigate } from "react-router";

// Mock Data untuk Jaringan Irigasi
const irrigationData = [
    {
        id: 1,
        nomorDaerah: "DI.001",
        namaDaerah: "Irigasi Maju Jaya",
        kecamatan: "Sukamaju",
        luas: 1200,
        indeksPertanaman: 250,
        produksi: 6.5,
        tahun: 2022,
    },
    {
        id: 2,
        nomorDaerah: "DI.002",
        namaDaerah: "Irigasi Sumber Makmur",
        kecamatan: "Karangrejo",
        luas: 850,
        indeksPertanaman: 280,
        produksi: 7.1,
        tahun: 2021,
    },
    {
        id: 3,
        nomorDaerah: "DI.003",
        namaDaerah: "Irigasi Tani Sejahtera",
        kecamatan: "Sukamaju",
        luas: 1500,
        indeksPertanaman: 260,
        produksi: 6.8,
        tahun: 2023,
    },
    {
        id: 4,
        nomorDaerah: "DI.004",
        namaDaerah: "Irigasi Air Bersih",
        kecamatan: "Wonokromo",
        luas: 700,
        indeksPertanaman: 300,
        produksi: 7.5,
        tahun: 2022,
    },
    {
        id: 5,
        nomorDaerah: "DI.005",
        namaDaerah: "Irigasi Cipta Karya",
        kecamatan: "Gondang",
        luas: 950,
        indeksPertanaman: 240,
        produksi: 6.2,
        tahun: 2023,
    },
    {
        id: 6,
        nomorDaerah: "DI.006",
        namaDaerah: "Irigasi Tirto Mulyo",
        kecamatan: "Karangrejo",
        luas: 1100,
        indeksPertanaman: 270,
        produksi: 6.9,
        tahun: 2020,
    },
    {
        id: 7,
        nomorDaerah: "DI.007",
        namaDaerah: "Irigasi Wening",
        kecamatan: "Sukamaju",
        luas: 1350,
        indeksPertanaman: 255,
        produksi: 6.6,
        tahun: 2021,
    },
    {
        id: 8,
        nomorDaerah: "DI.008",
        namaDaerah: "Irigasi Subur Abadi",
        kecamatan: "Wonokromo",
        luas: 650,
        indeksPertanaman: 310,
        produksi: 7.8,
        tahun: 2023,
    },
];

// Asumsi ini adalah komponen UI dari shadcn yang sudah diinstal
// Ini hanya mock untuk membuat kode berjalan
const ShadcnUIMock = {
    Table: ({ children, className }) => (
        <table className={className}>{children}</table>
    ),
    TableHeader: ({ children, className }) => (
        <thead className={className}>{children}</thead>
    ),
    TableBody: ({ children, className }) => (
        <tbody className={className}>{children}</tbody>
    ),
    TableRow: ({ children, className }) => (
        <tr className={className}>{children}</tr>
    ),
    TableHead: ({ children, className }) => (
        <th className={className}>{children}</th>
    ),
    TableCell: ({ children, className }) => (
        <td className={className}>{children}</td>
    ),
    DropdownMenu: ({ children }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, ...props }) => (
        <div {...props}>{children}</div>
    ),
    Dialog: ({ children }) => <div>{children}</div>,
    DialogContent: ({ children }) => <div>{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <h4>{children}</h4>,
    DialogDescription: ({ children }) => <p>{children}</p>,
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
    Input: (props) => <input {...props} />,
    Collapsible: ({ children }) => <div>{children}</div>,
    CollapsibleTrigger: ({ children }) => <div>{children}</div>,
    CollapsibleContent: ({ children }) => <div>{children}</div>,
};

// Gunakan komponen asli jika tersedia
export const ActualTable = Table || ShadcnUIMock.Table;
export const ActualTableHeader = TableHeader || ShadcnUIMock.TableHeader;
export const ActualTableBody = TableBody || ShadcnUIMock.TableBody;
export const ActualTableRow = TableRow || ShadcnUIMock.TableRow;
export const ActualTableHead = TableHead || ShadcnUIMock.TableHead;
export const ActualTableCell = TableCell || ShadcnUIMock.TableCell;
export const ActualDropdownMenu = DropdownMenu || ShadcnUIMock.DropdownMenu;
export const ActualDropdownMenuTrigger =
  DropdownMenuTrigger || ShadcnUIMock.DropdownMenuTrigger;
export const ActualDropdownMenuContent =
  DropdownMenuContent || ShadcnUIMock.DropdownMenuContent;
export const ActualDropdownMenuItem =
  DropdownMenuItem || ShadcnUIMock.DropdownMenuItem;
export const ActualDialog = Dialog || ShadcnUIMock.Dialog;
export const ActualDialogContent = DialogContent || ShadcnUIMock.DialogContent;
export const ActualDialogHeader = DialogHeader || ShadcnUIMock.DialogHeader;
export const ActualDialogTitle = DialogTitle || ShadcnUIMock.DialogTitle;
export const ActualDialogDescription =
  DialogDescription || ShadcnUIMock.DialogDescription;
export const ActualButton = Button || ShadcnUIMock.Button;
export const ActualInput = Input || ShadcnUIMock.Input;
export const ActualCollapsible = Collapsible || ShadcnUIMock.Collapsible;
export const ActualCollapsibleTrigger =
  CollapsibleTrigger || ShadcnUIMock.CollapsibleTrigger;
export const ActualCollapsibleContent =
  CollapsibleContent || ShadcnUIMock.CollapsibleContent;
