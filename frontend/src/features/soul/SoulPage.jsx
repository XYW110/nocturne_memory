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
export default function SoulPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("birth");
  const [soulVersion, setSoulVersion] = useState(0);

  const tabs = [
    { id: "birth", label: t("app.soul.tab_birth"), icon: Sparkles },
    { id: "emotion", label: t("app.soul.tab_emotion"), icon: Heart },
    { id: "relationship", label: t("app.soul.tab_relationship"), icon: Users },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header with secondary tabs */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 pt-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3">
          <Heart className="text-[var(--text-secondary)]" size={20} />
          {t("app.nav.soul")}
        </h1>
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-all",
                  isActive
                    ? "border-[var(--accent)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeTab === "birth" && (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
            <TemplatesSection onBorn={() => setSoulVersion((v) => v + 1)} />
          </div>
        )}

        {activeTab === "emotion" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 shadow-[var(--island-shadow-soft)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-1">
                <Heart size={14} className="text-[var(--text-secondary)]" />
                {t("app.soul.tab_emotion")}
              </h2>
              <EmotionPanel refreshTrigger={soulVersion} />
            </section>
            <section className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 shadow-[var(--island-shadow-soft)]">
              <EmotionLedger refreshTrigger={soulVersion} />
            </section>
          </div>
        )}

        {activeTab === "relationship" && (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
            <RelationshipPanel refreshTrigger={soulVersion} />
          </div>
        )}
      </div>
    </div>
  );
}
