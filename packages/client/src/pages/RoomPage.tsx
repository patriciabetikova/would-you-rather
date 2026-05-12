import { useNavigate, useParams } from "react-router-dom";
import { LobbyView } from "../components/LobbyView";
import { RoundView } from "../components/RoundView";
import { ScoreboardView } from "../components/ScoreboardView";
import { usePlayerId, useRoom } from "../socket";

export function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const room = useRoom();
  const [playerId] = usePlayerId();

  const me = room?.players.find((p) => p.id === playerId);

  if (!room || !playerId || !me) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-2">Room {code}</h1>
        <p className="text-slate-600 mb-6">You haven't joined this room.</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-700"
        >
          Back to home
        </button>
      </div>
    );
  }

  if (room.status === "lobby") {
    return <LobbyView room={room} me={me} />;
  }

  if (room.status === "in-progress" && room.currentRound) {
    return <RoundView room={room} round={room.currentRound} me={me} />;
  }

  if (room.status === "finished") {
    return <ScoreboardView room={room} me={me} />;
  }

  return null;
}
