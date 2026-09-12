import React from "react";
import { useLocation } from "react-router";
import WorkspaceModuleLayout from "@/modules/core/WorkspaceModuleLayout";
import ErpWorkspacePage from "@/pages/desk/workspace";
import BOMPage from "./pages/BOMPage";
import MasterPage from "./pages/MasterPage";
import WorkOrderPage from "./pages/WorkOrderPage";

export default function ManufacturingModule(){const {pathname}=useLocation();let content:React.ReactNode=<ErpWorkspacePage/>;if(pathname.startsWith("/desk/work-order"))content=<WorkOrderPage/>;else if(pathname.startsWith("/desk/bom"))content=<BOMPage/>;else if(pathname.startsWith("/desk/operation"))content=<MasterPage kind="operations"/>;else if(pathname.startsWith("/desk/workstation-type"))content=<MasterPage kind="workstation-types"/>;else if(pathname.startsWith("/desk/workstation"))content=<MasterPage kind="workstations"/>;return <WorkspaceModuleLayout slug="manufacturing">{content}</WorkspaceModuleLayout>}
