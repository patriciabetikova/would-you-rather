/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import {
  QUESTION_OPTION_MAX_LENGTH,
  QUESTION_OPTION_MIN_LENGTH,
} from "@wyr/shared";
import { useSocket } from "../socket";

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: "public" | "room";
}

export function QuestionModal({ isOpen, onClose, scope }: QuestionModalProps) {
  const socket = useSocket();
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOptionA("");
      setOptionB("");
      setError(null);
      setSuccess(false);
      setBusy(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const aLen = optionA.trim().length;
  const bLen = optionB.trim().length;
  const valid =
    aLen >= QUESTION_OPTION_MIN_LENGTH &&
    aLen <= QUESTION_OPTION_MAX_LENGTH &&
    bLen >= QUESTION_OPTION_MIN_LENGTH &&
    bLen <= QUESTION_OPTION_MAX_LENGTH;

  const handleSubmit = () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    socket.emit(
      "question:submit",
      {
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        scope,
        categoryId: null,
      },
      (response) => {
        setBusy(false);
        if (!response.ok) {
          setError(response.error.message);
          return;
        }
        setSuccess(true);
        setOptionA("");
        setOptionB("");
      },
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {scope === "public"
              ? "Add to the public pool"
              : "Contribute to this room"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Write a "would you rather" question with two options.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Would you rather…
            </span>
            <input
              autoFocus
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              maxLength={QUESTION_OPTION_MAX_LENGTH}
              placeholder="…have super speed"
              className="mt-1 w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              disabled={busy}
            />
          </label>

          <div className="text-center text-slate-400 text-sm">or</div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">…</span>
            <input
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              maxLength={QUESTION_OPTION_MAX_LENGTH}
              placeholder="…be able to fly"
              className="mt-1 w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              disabled={busy}
            />
          </label>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
              Thanks! Add another, or close to finish.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
            >
              {success ? "Done" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={!valid || busy}
              className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              {busy ? "Sending…" : success ? "Add another" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
