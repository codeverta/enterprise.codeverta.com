import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { ErpWorkspace, WorkspaceNavigationItem } from "@/lib/erp-workspaces";

export type Permission = { resource: string; allow_page: boolean; allow_menu: boolean };
type Role = { enabled: boolean; desk_access: boolean; permissions?: Permission[] };
export type MyPermissions = { legacy_admin: boolean; assignments?: Array<{ role: Role }>; profiles?: Array<{ roles?: Role[] }> };

const match = (rule: string, resource: string) => {
  const normalizedRule = String(rule || "").trim().toLowerCase();
  const normalizedResource = String(resource || "").trim().toLowerCase();
  return normalizedRule === "*" || normalizedRule === normalizedResource || (normalizedRule.endsWith("*") && normalizedResource.startsWith(normalizedRule.slice(0, -1)));
};

export const activePermissions = (data: MyPermissions | null) => {
  if (!data) return [];
  const direct = (data.assignments || []).map((assignment) => assignment.role);
  const profileRoles = (data.profiles || []).flatMap((profile) => profile.roles || []);
  return [...direct, ...profileRoles]
    .filter((role) => role.enabled && role.desk_access)
    .flatMap((role) => role.permissions || []);
};

export const canAccessDeskPage = (data: MyPermissions | null, pathname: string) => {
  if (!data) return false;
  if (data.legacy_admin) return true;
  return activePermissions(data).some((permission) => match(permission.resource, pathname) && permission.allow_page);
};

export const canSeeDeskMenu = (data: MyPermissions | null, href: string) => {
  if (!data) return false;
  if (data.legacy_admin) return true;
  const pathname = href.split("?")[0];
  return activePermissions(data).some((permission) => match(permission.resource, pathname) && permission.allow_menu);
};

export const canAccessModule = (data: MyPermissions | null, slug: string, workspace?: ErpWorkspace) => {
  if (!data) return false;
  if (data.legacy_admin) return true;
  if (activePermissions(data).some((permission) => match(permission.resource, `module:${slug}`) && permission.allow_menu)) return true;
  return workspace ? workspace.navigation.some((item) => item.items ? item.items.some((child) => canSeeDeskMenu(data, child.href)) : canSeeDeskMenu(data, item.href)) : false;
};

export const filterWorkspaceNavigation = (data: MyPermissions | null, items: WorkspaceNavigationItem[]) => {
  if (data?.legacy_admin) return items;
  return items.flatMap((item) => {
    if (item.items) {
      const children = filterWorkspaceNavigation(data, item.items);
      return children.length ? [{ ...item, items: children }] : [];
    }
    return canSeeDeskMenu(data, item.href) ? [item] : [];
  });
};

let permissionRequest: Promise<MyPermissions> | null = null;
let permissionToken = "";
export const loadMyPermissions = async () => {
  const currentToken = localStorage.getItem("accessToken") || "";
  if (permissionToken !== currentToken) {
    permissionToken = currentToken;
    permissionRequest = null;
  }
  permissionRequest ||= api.get<MyPermissions>("/authorization/me").then((response) => response.data).catch((error) => {
    permissionRequest = null;
    throw error;
  });
  return permissionRequest;
};

export const clearMyPermissionsCache = () => { permissionRequest = null; permissionToken = ""; };

export const useMyPermissions = (enabled = true) => {
  const [data, setData] = useState<MyPermissions | null>(null);
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    let active = true;
    if (!enabled) { setLoading(false); return; }
    loadMyPermissions().then((value) => active && setData(value)).catch(() => active && setData(null)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [enabled]);
  return { data, loading };
};

export const resolveAuthenticatedLandingPath = async (user: { role?: unknown } | null | undefined) => {
  if (Number(user?.role || 0) >= 99) return "/desk";
  try {
    const data = await loadMyPermissions();
    const roles = [...(data.assignments || []).map((item) => item.role), ...(data.profiles || []).flatMap((item) => item.roles || [])];
    return roles.some((role) => role.enabled && role.desk_access && (role.permissions || []).some((permission) => permission.allow_page || permission.allow_menu)) ? "/desk" : "/dashboard";
  } catch { return "/dashboard"; }
};
