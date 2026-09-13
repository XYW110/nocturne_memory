import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart, Sparkles, Users } from "lucide-react";
import clsx from "clsx";
import TemplatesSection from "../soul/TemplatesSection";
import EmotionPanel from "../soul/EmotionPanel";
import EmotionLedger from "../soul/EmotionLedger";
import RelationshipPanel from "../soul/RelationshipPanel";
import { NavLink } from "react-router-dom";

const TABS = [
  { id: "birth", icon: Sparkles },
  { id: "emotion", icon: Heart },
  { id: "relationship", icon: Users },
];

/**
 * MobileSoul — tabbed mobile soul page.
 * Reuses TemplatesSection, EmotionPanel, EmotionLedger, RelationshipPanel.
 * Settings link at bottom.
 */
export default function MobileSoul() {
  const { t } = useTranslation("mobile");
  const [activeTab, setActiveTab] = useState("birth");
  const [soulVersion, setSoulVersion] = useState(0);

  const handleBorn = () => setSoulVersion((v) => v + 1);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-nocturne-bg-secondary flex">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-rose-500 text-rose-400 bg-nocturne-bg-tertiary/30"
                  : "border-transparent text-nocturne-text-secondary hover:text-nocturne-text-primary"
              )}
            >
              <Icon size={16} />
              {t(`soul.tab.${tab.id}`)}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {activeTab === "birth" && <TemplatesSection onBorn={handleBorn} />}

        {activeTab === "emotion" && (
          <div className="space-y-6">
            <EmotionPanel refreshTrigger={soulVersion} />
            <EmotionLedger refreshTrigger={soulVersion} />
          </div>
        )}

        {activeTab === "relationship" && (
          <RelationshipPanel refreshTrigger={soulVersion} />
        )}
      </div>

      {/* Settings link */}
      <div className="flex-shrink-0 border-t border-[var(--color-border)] bg-nocturne-bg-secondary px-4 py-2">
        <NavLink
          to="/m/settings"
          className="flex items-center justify-center gap-1 text-sm text-nocturne-text-muted hover:text-nocturne-text-secondary py-2"
        >
          ⚙ {t("soul.settingsEntry")}
        </NavLink>
      </div>
    </div>
  );
}
