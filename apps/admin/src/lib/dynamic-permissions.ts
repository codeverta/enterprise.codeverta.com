import api from "@/lib/api";

type Permission = { resource: string; allow_page: boolean; allow_menu: boolean };
type Role = { enabled: boolean; desk_access: boolean; permissions?: Permission[] };
export type MyPermissions = { legacy_admin: boolean; assignments?: Array<{ role: Role }>; profiles?: Array<{ roles?: Role[] }> };

const match = (rule: string, resource: string) => {
  const normalizedRule = String(rule || "").trim().toLowerCase();
  const normalizedResource = String(resource || "").trim().toLowerCase();
  return normalizedRule === "*" || normalizedRule === normalizedResource || (normalizedRule.endsWith("*") && normalizedResource.startsWith(normalizedRule.slice(0, -1)));
};

export const canAccessDeskPage = (data: MyPermissions | null, pathname: string) => {
  if (!data) return false;
  if (data.legacy_admin) return true;
  const direct = (data.assignments || []).map((assignment) => assignment.role);
  const profileRoles = (data.profiles || []).flatMap((profile) => profile.roles || []);
  return [...direct, ...profileRoles].some((role) => role.enabled && role.desk_access && (role.permissions || []).some((permission) => match(permission.resource, pathname) && (permission.allow_page || permission.allow_menu)));
};

export const loadMyPermissions = async () => (await api.get<MyPermissions>("/authorization/me")).data;

export const resolveAuthenticatedLandingPath = async (user: { role?: unknown } | null | undefined) => {
  if (Number(user?.role || 0) >= 99) return "/desk";
  try {
    const data = await loadMyPermissions();
    const roles = [...(data.assignments || []).map((item) => item.role), ...(data.profiles || []).flatMap((item) => item.roles || [])];
    return roles.some((role) => role.enabled && role.desk_access && (role.permissions || []).some((permission) => permission.allow_page || permission.allow_menu)) ? "/desk" : "/dashboard";
  } catch { return "/dashboard"; }
};
