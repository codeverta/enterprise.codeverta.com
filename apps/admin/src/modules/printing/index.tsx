import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import PrintFormatFormPage from "./pages/PrintFormatFormPage";
import PrintFormatListPage from "./pages/PrintFormatListPage";
import PrintingToolPage from "./pages/PrintingToolPage";

export default function PrintingModule() {
  const { pathname } = useLocation();
  let content;
  if (pathname.startsWith("/desk/print-format/")) content = <PrintFormatFormPage />;
  else if (pathname === "/desk/print-format" || pathname === "/desk/printing") content = <PrintFormatListPage />;
  else content = <PrintingToolPage />;
  return <WorkspaceModuleLayout slug="printing">{content}</WorkspaceModuleLayout>;
}
