import { useNavigate, useParams } from "react-router-dom";
import { usePlayerId, useRoom } from "../socket";

export function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const room = useRoom();
  const [playerId] = usePlayerId();

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-2">Room {code}</h1>
        <p className="text-slate-600 mb-6">You haven't joined this room yet.</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-700"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Room {room.code}</h1>
            <p className="text-sm text-slate-500 uppercase tracking-wide">
              {room.status}
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Leave
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold mb-3 text-sm text-slate-600">
            Players ({room.players.length}/10)
          </h2>
          <ul className="space-y-2">
            {room.players.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-sm py-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium">{p.nickname}</span>
                {p.id === playerId && (
                  <span className="text-xs text-slate-400">(you)</span>
                )}
                {p.isHost && (
                  <span className="text-xs text-amber-600 font-semibold ml-auto">
                    HOST
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-400 text-center font-mono">
          Lobby UI lands here next — settings, contribute, start.
        </p>
      </div>
    </div>
  );
}
