import { SHARED_VERSION } from "@wyr/shared";

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900">
      <h1 className="text-4xl font-bold mb-4">Would You Rather</h1>
      <p className="text-slate-600">React + Vite + Tailwind v4 scaffold</p>
      <p className="mt-8 text-sm text-slate-400 font-mono">
        @wyr/shared v{SHARED_VERSION}
      </p>
    </div>
  );
}

export default App;
