import React, { useState } from "react";
import { Heart, Sparkles, Users } from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import TemplatesSection from "./TemplatesSection";
import EmotionPanel from "./EmotionPanel";
import EmotionLedger from "./EmotionLedger";
import RelationshipPanel from "./RelationshipPanel";

// Top-level Soul page. Hosts three secondary tabs (Birth / Emotion /
// Relationship) and a shared `soulVersion` counter that is bumped whenever a
// birth completes, so the emotion & relationship panels can refresh.
//
// Layout follows the app-wide island pattern: page content sits in floating
// rounded cards on the --bg-base canvas, matching Review/Maintenance/Memory.
export default function SoulPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("birth");
  const [soulVersion, setSoulVersion] = useState(0);

  const tabs = [
    { id: "birth", label: t("app.soul.tab_birth"), icon: Sparkles },
    { id: "emotion", label: t("app.soul.tab_emotion"), icon: Heart },
    { id: "relationship", label: t("app.soul.tab_relationship"), icon: Users },
  ];

  const tabClass = ({ isActive }) =>
    clsx(
      "flex items-center gap-2 px-3 py-1.5 min-h-[var(--tap-target)] rounded-[var(--radius-md)] text-sm font-medium whitespace-nowrap transition-colors",
      isActive
        ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
        : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
    );

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)] p-[var(--gap-island)] gap-[var(--gap-island)] overflow-hidden">
      {/* Tab bar island */}
      <div className="h-12 flex-shrink-0 rounded-[var(--radius-xl)] bg-[var(--surface)] shadow-[var(--island-shadow)] border border-[var(--border)] flex items-center px-4 gap-4 overflow-x-auto">
        <div className="flex items-center gap-2 font-bold text-[var(--text-primary)] mr-2 whitespace-nowrap">
          <Heart className="w-5 h-5 text-[var(--text-primary)] flex-shrink-0" />
          <span>{t("app.nav.soul")}</span>
        </div>
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={tabClass({ isActive: activeTab === tab.id })}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content island */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-[var(--radius-xl)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--island-shadow)] px-6 py-5">
        {activeTab === "birth" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            <TemplatesSection onBorn={() => setSoulVersion((v) => v + 1)} />
          </div>
        )}

        {activeTab === "emotion" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="lg:col-span-2 bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 shadow-[var(--island-shadow-soft)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-1">
                <Heart size={14} className="text-[var(--text-secondary)]" />
                {t("app.soul.tab_emotion")}
              </h2>
              <EmotionPanel refreshTrigger={soulVersion} />
            </section>
            <section className="bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 shadow-[var(--island-shadow-soft)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-1">
                <Heart size={14} className="text-[var(--text-muted)]" />
                {t("settings.emotion.ledger_title")}
              </h2>
              <EmotionLedger refreshTrigger={soulVersion} />
            </section>
          </div>
        )}

        {activeTab === "relationship" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            <RelationshipPanel refreshTrigger={soulVersion} />
          </div>
        )}
      </div>
    </div>
  );
}
