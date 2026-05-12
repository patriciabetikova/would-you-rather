import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MAX_PLAYERS_PER_ROOM } from "@wyr/shared";
import type { GameSettings, Player, Room } from "@wyr/shared";
import { usePlayerId, useSocket } from "../socket";
import { QuestionModal } from "./QuestionModal";
import { SettingsPanel } from "./SettingsPanel";

interface LobbyViewProps {
  room: Room;
  me: Player;
}

export function LobbyView({ room, me }: LobbyViewProps) {
  const navigate = useNavigate();
  const socket = useSocket();
  const [, setPlayerId] = usePlayerId();

  const [contributeOpen, setContributeOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const isHost = me.isHost;

  const handleSettingsChange = (partial: Partial<GameSettings>) => {
    setActionError(null);
    socket.emit("room:updateSettings", partial, (response) => {
      if (!response.ok) setActionError(response.error.message);
    });
  };

  const handleLeave = () => {
    socket.emit("room:leave");
    setPlayerId(null);
    navigate("/");
  };

  const handleStart = () => {
    if (starting) return;
    setStarting(true);
    setActionError(null);
    socket.emit("game:start", (response) => {
      setStarting(false);
      if (!response.ok) setActionError(response.error.message);
    });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
    } catch {
      // ignore
    }
  };

  const canStart =
    isHost &&
    room.players.length >= 2 &&
    (!room.settings.requireContribution ||
      room.players.every((p) => p.hasContributedQuestion));

  const emptySlots = MAX_PLAYERS_PER_ROOM - room.players.length;

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-3xl font-bold">Room {room.code}</h1>
              <p className="text-sm text-slate-500 uppercase tracking-wide">
                {room.status}
              </p>
            </div>
            <button
              onClick={handleLeave}
              className="text-sm text-slate-600 hover:text-red-600"
            >
              Leave room
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <p className="text-sm text-slate-600 mb-2">Share this code:</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold tracking-widest font-mono">
                {room.code}
              </span>
              <button
                onClick={handleCopyCode}
                className="ml-auto px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="font-semibold mb-3 text-sm text-slate-600">
              Players ({room.players.length}/{MAX_PLAYERS_PER_ROOM})
            </h2>
            <ul className="space-y-2">
              {room.players.map((p) => (
                <li key={p.id} className="flex items-center gap-3 text-sm py-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.isConnected ? "bg-green-500" : "bg-slate-300"
                    }`}
                  />
                  <span className="font-medium">{p.nickname}</span>
                  {p.id === me.id && (
                    <span className="text-xs text-slate-400">(you)</span>
                  )}
                  {p.hasContributedQuestion && (
                    <span className="text-xs text-emerald-600">
                      ✓ contributed
                    </span>
                  )}
                  {p.isHost && (
                    <span className="text-xs text-amber-600 font-semibold ml-auto">
                      HOST
                    </span>
                  )}
                </li>
              ))}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <li
                  key={`empty-${i}`}
                  className="flex items-center gap-3 text-sm py-1 opacity-30"
                >
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  <span className="italic">empty slot</span>
                </li>
              ))}
            </ul>
          </div>

          <SettingsPanel
            settings={room.settings}
            isHost={isHost}
            disabled={room.status !== "lobby"}
            onChange={handleSettingsChange}
          />

          <button
            onClick={() => setContributeOpen(true)}
            className="w-full py-3 bg-white border-2 border-slate-300 rounded-lg font-semibold hover:bg-slate-100 flex items-center justify-center gap-2"
          >
            <span>Contribute a question to this room</span>
            {me.hasContributedQuestion && (
              <span className="text-emerald-600">✓</span>
            )}
          </button>

          {actionError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
              {actionError}
            </div>
          )}

          {isHost ? (
            <button
              onClick={handleStart}
              disabled={!canStart || starting}
              className="w-full py-4 bg-slate-900 text-white rounded-lg font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              {starting ? "Starting…" : "Start game"}
            </button>
          ) : (
            <div className="text-center text-sm text-slate-500 py-4">
              Waiting for the host to start the game…
            </div>
          )}
        </div>
      </div>

      <QuestionModal
        isOpen={contributeOpen}
        onClose={() => setContributeOpen(false)}
        scope="room"
      />
    </>
  );
}
