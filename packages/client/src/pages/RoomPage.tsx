import { useParams } from "react-router-dom";
import { JoinViaLinkView } from "../components/JoinViaLinkView";
import { LobbyView } from "../components/LobbyView";
import { RoundView } from "../components/RoundView";
import { ScoreboardView } from "../components/ScoreboardView";
import { usePlayerId, useRoom } from "../socket";

export function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const room = useRoom();
  const [playerId] = usePlayerId();

  // Visited via a link (or refreshed page): no player identity yet.
  // Prompt for nickname using the code from the URL.
  if (!playerId && code) {
    return <JoinViaLinkView code={code} />;
  }

  const me = room?.players.find((p) => p.id === playerId);

  // Have a playerId but room state hasn't arrived yet — brief loading
  if (!room || !me) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 text-sm">Connecting…</p>
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
