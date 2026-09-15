import { describe, expect, it } from "vitest";
import { Store } from "lucide-react";
import {
  canAccessDeskPage,
  canAccessModule,
  canSeeDeskMenu,
  filterWorkspaceNavigation,
  type MyPermissions,
} from "./dynamic-permissions";

const permissions: MyPermissions = {
  legacy_admin: false,
  assignments: [{
    role: {
      enabled: true,
      desk_access: true,
      permissions: [
        { resource: "module:selling", allow_menu: true, allow_page: false },
        { resource: "/desk/point-of-sale*", allow_menu: true, allow_page: true },
        { resource: "/desk/pos-opening-entry*", allow_menu: true, allow_page: true },
        { resource: "/desk/pos-closing-entry*", allow_menu: true, allow_page: true },
      ],
    },
  }],
};

describe("dynamic role access", () => {
  it("allows cashier POS pages including detail routes and denies other selling pages", () => {
    expect(canAccessDeskPage(permissions, "/desk/point-of-sale")).toBe(true);
    expect(canAccessDeskPage(permissions, "/desk/pos-closing-entry/123")).toBe(true);
    expect(canAccessDeskPage(permissions, "/desk/sales-order")).toBe(false);
  });

  it("keeps page access and menu visibility independent", () => {
    const hiddenMenu: MyPermissions = {
      ...permissions,
      assignments: [{ role: { enabled: true, desk_access: true, permissions: [{ resource: "/desk/point-of-sale*", allow_menu: false, allow_page: true }] } }],
    };
    expect(canAccessDeskPage(hiddenMenu, "/desk/point-of-sale")).toBe(true);
    expect(canSeeDeskMenu(hiddenMenu, "/desk/point-of-sale")).toBe(false);
  });

  it("filters inaccessible sidebar children and retains their parent group", () => {
    const navigation = [{
      name: "Point of Sale",
      href: "/desk/selling",
      icon: Store,
      items: [
        { name: "POS", href: "/desk/point-of-sale", icon: Store },
        { name: "Sales Order", href: "/desk/sales-order", icon: Store },
      ],
    }];
    const filtered = filterWorkspaceNavigation(permissions, navigation);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].items?.map((item) => item.name)).toEqual(["POS"]);
    expect(canAccessModule(permissions, "selling")).toBe(true);
  });
});
