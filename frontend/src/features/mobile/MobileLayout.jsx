import React from "react";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Database, Heart, Sparkles } from "lucide-react";
import clsx from "clsx";
import NamespaceSelector from "../../components/NamespaceSelector";
import MobileReview from "./MobileReview";
import MobileMemory from "./MobileMemory";
import MobileSoul from "./MobileSoul";
import MobileMaintenance from "./MobileMaintenance";
import MobileSettings from "./MobileSettings";

const TABS = [
  { id: "review", path: "/m/review", icon: ShieldCheck },
  { id: "memory", path: "/m/memory", icon: Database },
  { id: "soul", path: "/m/soul", icon: Heart },
  { id: "maintenance", path: "/m/maintenance", icon: Sparkles },
];

// Pages that don't need the namespace selector in the top bar
const NO_NAMESPACE_PATHS = ["/m/settings"];

export default function MobileLayout() {
  const { t } = useTranslation("mobile");
  const location = useLocation();
  const showNamespace = !NO_NAMESPACE_PATHS.includes(location.pathname);
  const isSettings = location.pathname === "/m/settings";

  const activeTab = TABS.find((tab) => location.pathname.startsWith(tab.path));

  return (
    <div className="mobile-layout-container flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Top Bar */}
      <div
        className="h-12 flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] flex items-center px-4 gap-3"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {isSettings ? (
          <NavLink
            to="/m/soul"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"
          >
            ← <span className="text-sm">{t("settings.back")}</span>
          </NavLink>
        ) : (
          <span className="text-sm font-semibold truncate">
            {t(`nav.${activeTab?.id || "review"}`)}
          </span>
        )}
        <div className="ml-auto">{showNamespace && <NamespaceSelector />}</div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Routes>
          <Route path="/m" element={<Navigate to="/m/review" replace />} />
          <Route path="/m/review" element={<MobileReview />} />
          <Route path="/m/memory" element={<MobileMemory />} />
          <Route path="/m/soul" element={<MobileSoul />} />
          <Route path="/m/maintenance" element={<MobileMaintenance />} />
          <Route path="/m/settings" element={<MobileSettings />} />
        </Routes>
      </div>

      {/* Bottom Tab Bar */}
      <nav className="mobile-tab-bar h-14 flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] flex">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) =>
                clsx(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors",
                  "border-t-2",
                  isActive
                    ? "border-[var(--accent)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-muted)]"
                )
              }
            >
              <Icon size={20} />
              <span className="text-[10px] leading-none">
                {t(`nav.${tab.id}`)}
              </span>
            </NavLink>
          );
        })}
        {/* Switch to desktop button — tiny, bottom of tab bar */}
        <button
          onClick={() => {
            localStorage.setItem("mobile_preference", "desktop");
            window.location.replace("/review");
          }}
          className="flex items-center justify-center px-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          title={t("nav.switchDesktop")}
        >
          <span className="text-[10px]">🖥</span>
        </button>
      </nav>
    </div>
  );
}
