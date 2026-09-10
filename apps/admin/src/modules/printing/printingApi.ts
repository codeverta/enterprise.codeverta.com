import api from "@/lib/api";

export type PrintFormat = {
  id?: string;
  name: string;
  print_format_for: "DocType" | "Report";
  doc_type: string;
  report: string;
  module: string;
  default_print_language: string;
  custom_format: boolean;
  disabled: boolean;
  pdf_generator: "wkhtmltopdf" | "chrome";
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  align_labels_right: boolean;
  show_section_headings: boolean;
  line_breaks: boolean;
  font: string;
  page_number: string;
  css: string;
  created_at?: string;
  updated_at?: string;
};

export const emptyPrintFormat = (): PrintFormat => ({
  name: "",
  print_format_for: "DocType",
  doc_type: "",
  report: "",
  module: "",
  default_print_language: "id",
  custom_format: false,
  disabled: false,
  pdf_generator: "chrome",
  margin_top: 15,
  margin_bottom: 15,
  margin_left: 15,
  margin_right: 15,
  align_labels_right: false,
  show_section_headings: true,
  line_breaks: false,
  font: "",
  page_number: "Hide",
  css: "",
});

export async function listPrintFormats(query = "") {
  const response = await api.get<{ data: PrintFormat[] }>("/printing/print-formats", {
    params: query ? { q: query } : undefined,
  });
  return response.data.data || [];
}

export async function getPrintFormat(id: string) {
  const response = await api.get<PrintFormat>(`/printing/print-formats/${id}`);
  return response.data;
}

export async function savePrintFormat(value: PrintFormat) {
  if (value.id) {
    const response = await api.put<PrintFormat>(`/printing/print-formats/${value.id}`, value);
    return response.data;
  }
  const response = await api.post<PrintFormat>("/printing/print-formats", value);
  return response.data;
}

export async function deletePrintFormat(id: string) {
  await api.delete(`/printing/print-formats/${id}`);
}
