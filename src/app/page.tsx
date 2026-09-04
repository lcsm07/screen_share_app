import { Monitor, Zap } from "lucide-react";
import { HomeForm } from "@/components/HomeForm";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Monitor className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            ScreenShare<span className="text-brand-400">Rooms</span>
          </span>
        </div>
        <a
          href="https://livekit.io"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          Powered by LiveKit 
        </a>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-12 px-6 py-12">
        <div className="flex max-w-3xl flex-col items-center text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
            <Zap className="h-3 w-3 text-brand-400" /> Real-time · Anonymous · No
            sign-up
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            Share your screen in seconds
          </h1>
          <p className="mt-5 max-w-xl text-base text-zinc-400 sm:text-lg">
            Create a room, share your screen, and watch together with your
            friends or team — all right from the browser.
          </p>
        </div>

        <HomeForm />
      </section>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-6xl px-6 py-6">
        <p className="text-center text-xs text-zinc-500">
          Rooms are temporary and removed after 1 hour of inactivity.
        </p>
      </footer>
    </main>
  );
}
