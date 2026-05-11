import { useState } from "react";
import { SHARED_VERSION } from "@wyr/shared";
import type { Room } from "@wyr/shared";
import { createFakeSocket } from "./fake-socket";

function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (msg: string) =>
    setLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleRunDemo = () => {
    setLog([]);
    setRoom(null);

    const alice = createFakeSocket();
    alice.on("room:state", (r) => {
      setRoom(r);
      appendLog(`room:state → ${r.players.length} player(s) in ${r.code}`);
    });

    alice.emit("room:create", { nickname: "Alice" }, (response) => {
      if (!response.ok)
        return appendLog(`Create failed: ${response.error.message}`);
      const code = response.data.code;
      appendLog(`Alice created room ${code}`);

      setTimeout(() => {
        const bob = createFakeSocket();
        bob.emit("room:join", { code, nickname: "Bob" }, (resp) => {
          appendLog(
            resp.ok ? "Bob joined" : `Bob join failed: ${resp.error.message}`,
          );
        });
      }, 1000);

      setTimeout(() => {
        const charlie = createFakeSocket();
        charlie.emit("room:join", { code, nickname: "Charlie" }, (resp) => {
          appendLog(
            resp.ok
              ? "Charlie joined"
              : `Charlie join failed: ${resp.error.message}`,
          );
        });
      }, 2000);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Would You Rather</h1>
        <p className="text-slate-600 mb-8">
          Phase 2 — FakeSocketServer integration test
        </p>

        <button
          onClick={handleRunDemo}
          className="px-6 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors mb-8"
        >
          Run multiplayer demo
        </button>

        {room && (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-2xl font-bold">Room {room.code}</h2>
              <span className="text-xs text-slate-500 uppercase tracking-wide">
                {room.status}
              </span>
            </div>
            <h3 className="font-semibold mb-2 text-sm text-slate-600">
              Players ({room.players.length}/10)
            </h3>
            <ul className="space-y-1">
              {room.players.map((p) => (
                <li key={p.id} className="text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {p.nickname}
                  {p.isHost && (
                    <span className="text-xs text-amber-600 font-semibold">
                      HOST
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {log.length > 0 && (
          <div className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs space-y-1">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        <p className="mt-12 text-xs text-slate-400 font-mono">
          @wyr/shared v{SHARED_VERSION}
        </p>
      </div>
    </div>
  );
}

export default App;
