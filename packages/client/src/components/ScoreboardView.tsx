import { useNavigate } from "react-router-dom";
import type { Player, Room } from "@wyr/shared";
import { usePlayerId, useSocket } from "../socket";

interface ScoreboardViewProps {
  room: Room;
  me: Player;
}

export function ScoreboardView({ room, me }: ScoreboardViewProps) {
  const navigate = useNavigate();
  const socket = useSocket();
  const [, setPlayerId] = usePlayerId();

  const handleLeave = () => {
    socket.emit("room:leave");
    setPlayerId(null);
    navigate("/");
  };

  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const myRank = ranked.findIndex((p) => p.id === me.id) + 1;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Game over!</h1>
          <p className="text-slate-600">
            You finished {myRank}
            {ordinalSuffix(myRank)} place
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold mb-4 text-sm text-slate-600">
            Final scores
          </h2>
          <ul className="space-y-2">
            {ranked.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-md ${
                  p.id === me.id ? "bg-amber-50" : ""
                }`}
              >
                <span className="text-2xl w-8 text-center">
                  {medals[i] ?? `${i + 1}.`}
                </span>
                <span className="font-semibold flex-1">
                  {p.nickname}
                  {p.id === me.id && (
                    <span className="ml-2 text-xs text-slate-400">(you)</span>
                  )}
                </span>
                <span className="font-bold tabular-nums text-lg">
                  {p.score}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleLeave}
          className="w-full py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-700"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (k >= 11 && k <= 13) return "th";
  if (j === 1) return "st";
  if (j === 2) return "nd";
  if (j === 3) return "rd";
  return "th";
}
