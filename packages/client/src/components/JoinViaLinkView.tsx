import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from "@wyr/shared";
import { usePlayerId, useSocket } from "../socket";

interface JoinViaLinkViewProps {
  code: string;
}

export function JoinViaLinkView({ code }: JoinViaLinkViewProps) {
  const navigate = useNavigate();
  const socket = useSocket();
  const [, setPlayerId] = usePlayerId();

  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validNickname = nickname.trim().length >= NICKNAME_MIN_LENGTH;

  const handleJoin = () => {
    if (!validNickname || busy) return;
    setBusy(true);
    setError(null);
    socket.emit(
      "room:join",
      { code: code.toUpperCase(), nickname: nickname.trim() },
      (response) => {
        if (!response.ok) {
          setError(response.error.message);
          setBusy(false);
          return;
        }
        setPlayerId(response.data.playerId);
        // No navigation — we're already on /room/:code,
        // RoomPage will re-render now that playerId is set.
      },
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <p className="text-center text-slate-600 mb-2">Joining room</p>
        <h1 className="text-5xl font-bold text-center tracking-widest font-mono mb-8">
          {code.toUpperCase()}
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJoin();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Your nickname
            </span>
            <input
              autoFocus
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={NICKNAME_MAX_LENGTH}
              placeholder="e.g. Alex"
              className="mt-1 w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            disabled={!validNickname || busy}
            className="w-full py-3 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
          >
            {busy ? "Joining…" : "Join"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full py-2 text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to home
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
