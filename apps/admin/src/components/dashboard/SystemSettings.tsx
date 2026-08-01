import { NavLink } from "react-router";
import { Settings } from "lucide-react";
import clsx from "clsx";

interface SystemSettingsProps {
  isSidebarOpen: boolean;
}

export default function SystemSettings({ isSidebarOpen }: SystemSettingsProps) {
  return (
    <NavLink
      to="/dashboard/settings"
      data-onboarding="system-settings"
      data-onboarding-href="/settings"
      className={({ isActive }) =>
        clsx(
          "flex items-center w-full my-1 text-sm h-10 px-3 rounded-md transition-all duration-200 relative",
          !isSidebarOpen && "justify-center",
          isActive
            ? "bg-gray-100 text-blue-600"
            : "text-gray-600 hover:bg-gray-100"
        )
      }
      title="System Settings"
    >
      {({ isActive }) => (
        <>
          <div className="relative flex items-center justify-center">
            <Settings
              className={clsx(
                "h-4 w-4 transition-colors",
                isActive ? "text-blue-600" : "text-gray-600"
              )}
            />
          </div>

          {isSidebarOpen && (
            <span
              className={clsx(
                "ml-3 flex-1 text-left font-semibold transition-colors",
                isActive ? "text-blue-600" : "text-gray-700"
              )}
            >
              System Settings
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
