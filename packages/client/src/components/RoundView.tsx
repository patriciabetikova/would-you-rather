/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Player, Room, Round, VoteOption } from "@wyr/shared";
import { usePlayerId, useSocket } from "../socket";
import type { QuestionRating } from "@wyr/shared";

interface RoundViewProps {
  room: Room;
  round: Round;
  me: Player;
}

export function RoundView({ room, round }: RoundViewProps) {
  const navigate = useNavigate();
  const socket = useSocket();
  const [, setPlayerId] = usePlayerId();

  const [myVote, setMyVote] = useState<VoteOption | null>(null);
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, round.endsAt - Date.now()),
  );
  const [myRating, setMyRating] = useState<QuestionRating | null>(null);

  // Reset local vote when the round changes
  useEffect(() => {
    setMyVote(null);
  }, [round.questionId]);

  useEffect(() => {
    setMyRating(null);
  }, [round.questionId]);

  // Tick the countdown
  useEffect(() => {
    if (round.status !== "voting") return;
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, round.endsAt - Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [round.endsAt, round.status]);

  const isRevealed = round.status === "revealed";
  const results = round.results;

  const handleVote = (option: VoteOption) => {
    if (myVote || isRevealed) return;
    setMyVote(option); // optimistic UI
    socket.emit("vote:submit", { option }, (response) => {
      if (!response.ok) {
        setMyVote(null);
      }
    });
  };

  const handleRate = (rating: QuestionRating) => {
    if (myRating !== null) return;
    setMyRating(rating); // optimistic
    socket.emit(
      "question:rate",
      { questionId: round.question.id, rating },
      (response) => {
        if (!response.ok) setMyRating(null);
      },
    );
  };

  const handleLeave = () => {
    socket.emit("room:leave");
    setPlayerId(null);
    navigate("/");
  };

  const secondsLeft = Math.ceil(timeLeft / 1000);
  const totalPlayers = room.players.length;
  const votedCount = round.votedPlayerIds.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <p className="text-sm text-slate-500 uppercase tracking-wide">
              Round {room.roundNumber} of {room.settings.numberOfRounds}
            </p>
            {!isRevealed && (
              <p className="text-3xl font-bold tabular-nums">
                <span className={secondsLeft <= 5 ? "text-red-600" : ""}>
                  {secondsLeft}s
                </span>
              </p>
            )}
          </div>
          <button
            onClick={handleLeave}
            className="text-sm text-slate-600 hover:text-red-600"
          >
            Leave
          </button>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">
          Would you rather…
        </h1>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <OptionCard
            label={round.question.optionA}
            option="A"
            myVote={myVote}
            isRevealed={isRevealed}
            tally={results?.tallyA ?? 0}
            totalVotes={totalPlayers}
            onVote={() => handleVote("A")}
            voters={
              isRevealed && results
                ? room.players.filter((p) => results.votes[p.id] === "A")
                : []
            }
          />
          <OptionCard
            label={round.question.optionB}
            option="B"
            myVote={myVote}
            isRevealed={isRevealed}
            tally={results?.tallyB ?? 0}
            totalVotes={totalPlayers}
            onVote={() => handleVote("B")}
            voters={
              isRevealed && results
                ? room.players.filter((p) => results.votes[p.id] === "B")
                : []
            }
          />
        </div>

        {!isRevealed && (
          <div className="text-center text-sm text-slate-600">
            {myVote ? (
              <>
                Voted! Waiting for others… ({votedCount}/{totalPlayers})
              </>
            ) : (
              <>
                {votedCount}/{totalPlayers} have voted
              </>
            )}
          </div>
        )}
        {isRevealed && !round.question.isCustom && (
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-sm text-slate-600 mr-1">
              Rate this question:
            </span>
            <button
              type="button"
              onClick={() => handleRate("up")}
              disabled={myRating !== null}
              className={`px-3 py-1.5 rounded-lg border transition-all text-lg ${
                myRating === "up"
                  ? "bg-emerald-50 border-emerald-500"
                  : "border-slate-300 hover:bg-slate-100"
              } disabled:cursor-default`}
              aria-label="Like this question"
            >
              👍
            </button>
            <button
              type="button"
              onClick={() => handleRate("down")}
              disabled={myRating !== null}
              className={`px-3 py-1.5 rounded-lg border transition-all text-lg ${
                myRating === "down"
                  ? "bg-red-50 border-red-500"
                  : "border-slate-300 hover:bg-slate-100"
              } disabled:cursor-default`}
              aria-label="Dislike this question"
            >
              👎
            </button>
            {myRating !== null && (
              <span className="text-xs text-slate-500 ml-1">Thanks!</span>
            )}
          </div>
        )}

        {isRevealed && (
          <div className="text-center text-sm text-slate-500">
            Next round starting…
          </div>
        )}
      </div>
    </div>
  );
}

interface OptionCardProps {
  label: string;
  option: VoteOption;
  myVote: VoteOption | null;
  isRevealed: boolean;
  tally: number;
  totalVotes: number;
  onVote: () => void;
  voters: Player[];
}

function OptionCard({
  label,
  myVote,
  option,
  isRevealed,
  tally,
  totalVotes,
  onVote,
  voters,
}: OptionCardProps) {
  const youVoted = myVote === option;
  const percentage =
    totalVotes > 0 ? Math.round((tally / totalVotes) * 100) : 0;
  const disabled = myVote !== null || isRevealed;

  return (
    <button
      type="button"
      onClick={onVote}
      disabled={disabled}
      className={`relative text-left p-6 rounded-lg border-2 transition-all overflow-hidden min-h-32 ${
        isRevealed
          ? youVoted
            ? "border-amber-500 bg-amber-50"
            : "border-slate-200 bg-white"
          : youVoted
            ? "border-slate-900 bg-slate-100"
            : "border-slate-200 bg-white hover:border-slate-400 cursor-pointer"
      } ${myVote !== null && !youVoted && !isRevealed ? "opacity-50" : ""}`}
    >
      {isRevealed && (
        <div
          className="absolute inset-y-0 left-0 bg-slate-200/60 transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      )}
      <div className="relative">
        <p className="text-xl font-semibold mb-2">{label}</p>
        {isRevealed && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-2xl font-bold tabular-nums">
              {tally}{" "}
              <span className="text-sm font-normal text-slate-500">
                ({percentage}%)
              </span>
            </span>
            <span className="text-xs text-slate-600 text-right max-w-[60%] truncate">
              {voters.map((p) => p.nickname).join(", ")}
            </span>
          </div>
        )}
        {!isRevealed && youVoted && (
          <p className="text-xs text-slate-500 mt-2">Your pick</p>
        )}
      </div>
    </button>
  );
}
