import type { GameSettings, QuestionSource } from "@wyr/shared";

interface SettingsPanelProps {
  settings: GameSettings;
  isHost: boolean;
  disabled: boolean;
  onChange: (partial: Partial<GameSettings>) => void;
}

const ROUND_LENGTHS = [15, 20, 30] as const;
const ROUND_COUNTS = [5, 10, 15] as const;
const SOURCES: { value: QuestionSource; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "custom", label: "Custom" },
  { value: "both", label: "Both" },
];

export function SettingsPanel({
  settings,
  isHost,
  disabled,
  onChange,
}: SettingsPanelProps) {
  const editable = isHost && !disabled;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-semibold text-sm text-slate-600">Settings</h2>
        {!isHost && (
          <span className="text-xs text-slate-400">host can edit</span>
        )}
      </div>

      <div className="space-y-4">
        <Segmented
          label="Round length"
          options={ROUND_LENGTHS.map((n) => ({ value: n, label: `${n}s` }))}
          value={settings.roundLengthSeconds}
          onChange={(v) => onChange({ roundLengthSeconds: v })}
          editable={editable}
        />
        <Segmented
          label="Number of rounds"
          options={ROUND_COUNTS.map((n) => ({ value: n, label: String(n) }))}
          value={settings.numberOfRounds}
          onChange={(v) => onChange({ numberOfRounds: v })}
          editable={editable}
        />
        <Segmented
          label="Question source"
          options={SOURCES}
          value={settings.questionSource}
          onChange={(v) => onChange({ questionSource: v })}
          editable={editable}
        />
        <label className="flex items-center justify-between pt-1">
          <span className="text-sm text-slate-700">
            Require every player to contribute
          </span>
          <input
            type="checkbox"
            checked={settings.requireContribution}
            onChange={(e) =>
              onChange({ requireContribution: e.target.checked })
            }
            disabled={!editable}
            className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
          />
        </label>
      </div>
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  editable: boolean;
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  editable,
}: SegmentedProps<T>) {
  return (
    <div>
      <div className="text-sm text-slate-700 mb-1">{label}</div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            disabled={!editable}
            className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
              value === opt.value
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            } ${!editable ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
