import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ROOM_CODE_LENGTH,
} from "@wyr/shared";
import { useSocket, usePlayerId } from "../socket";

type Mode = "idle" | "host" | "join" | "contribute";

export function HomePage() {
  const socket = useSocket();
  const [, setPlayerId] = usePlayerId();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("idle");
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setError(null);
    setBusy(false);
    setNickname("");
    setRoomCode("");
    setMode("idle");
  };

  const validNickname = nickname.trim().length >= NICKNAME_MIN_LENGTH;
  const validCode = roomCode.trim().length === ROOM_CODE_LENGTH;

  const handleHost = () => {
    if (!validNickname || busy) return;
    setBusy(true);
    setError(null);
    socket.emit("room:create", { nickname: nickname.trim() }, (response) => {
      if (!response.ok) {
        setError(response.error.message);
        setBusy(false);
        return;
      }
      setPlayerId(response.data.playerId);
      navigate(`/room/${response.data.code}`);
    });
  };

  const handleJoin = () => {
    if (!validNickname || !validCode || busy) return;
    const code = roomCode.trim().toUpperCase();
    setBusy(true);
    setError(null);
    socket.emit(
      "room:join",
      { code, nickname: nickname.trim() },
      (response) => {
        if (!response.ok) {
          setError(response.error.message);
          setBusy(false);
          return;
        }
        setPlayerId(response.data.playerId);
        navigate(`/room/${code}`);
      },
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-5xl font-bold text-center mb-2">
          Would You Rather
        </h1>
        <p className="text-center text-slate-600 mb-12">
          A real-time multiplayer party game
        </p>

        {mode === "idle" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("host")}
              className="w-full py-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
            >
              Host a room
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full py-4 bg-white border-2 border-slate-900 text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
            >
              Join a room
            </button>
            <button
              onClick={() => setMode("contribute")}
              className="w-full py-3 text-slate-600 hover:text-slate-900 transition-colors text-sm"
            >
              Add questions to the pool
            </button>
          </div>
        )}

        {mode === "host" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleHost();
            }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold">Host a room</h2>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Your nickname
              </span>
              <input
                autoFocus
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={NICKNAME_MAX_LENGTH}
                placeholder="e.g. Alice"
                className="mt-1 w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                disabled={busy}
              />
            </label>
            <button
              type="submit"
              disabled={!validNickname || busy}
              className="w-full py-3 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              {busy ? "Creating…" : "Create room"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="w-full py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              ← Back
            </button>
          </form>
        )}

        {mode === "join" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin();
            }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold">Join a room</h2>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Room code
              </span>
              <input
                autoFocus
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={ROOM_CODE_LENGTH}
                placeholder="ABCD"
                className="mt-1 w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 uppercase tracking-widest text-center font-mono text-xl"
                disabled={busy}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Your nickname
              </span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={NICKNAME_MAX_LENGTH}
                placeholder="e.g. Bob"
                className="mt-1 w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                disabled={busy}
              />
            </label>
            <button
              type="submit"
              disabled={!validNickname || !validCode || busy}
              className="w-full py-3 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              {busy ? "Joining…" : "Join"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="w-full py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              ← Back
            </button>
          </form>
        )}

        {mode === "contribute" && (
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-bold">Add questions</h2>
            <p className="text-slate-600">
              Question contribution modal lands here in the next step.
            </p>
            <button
              onClick={reset}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              ← Back
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
