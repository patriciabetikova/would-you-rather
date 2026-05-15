import type { GameSettings, QuestionSource } from "@wyr/shared";

interface SettingsSummaryProps {
  settings: GameSettings;
}

const SOURCE_LABELS: Record<QuestionSource, string> = {
  public: "Public questions",
  custom: "Custom only",
  both: "Public + custom",
};

export function SettingsSummary({ settings }: SettingsSummaryProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500 font-medium mr-1">Settings:</span>
        <span className="px-2 py-1 bg-slate-100 rounded text-slate-700">
          {settings.numberOfRounds} rounds × {settings.roundLengthSeconds}s
        </span>
        <span className="px-2 py-1 bg-slate-100 rounded text-slate-700">
          {SOURCE_LABELS[settings.questionSource]}
        </span>
        {settings.requireContribution && (
          <span className="px-2 py-1 bg-amber-100 rounded text-amber-800 font-medium">
            Contribution required
          </span>
        )}
      </div>
    </div>
  );
}
