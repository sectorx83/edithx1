import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { unlockSite } from "@/lib/gate.functions";

export const Route = createFileRoute("/unlock")({
  head: () => ({
    meta: [
      { title: "E.D.I.T.H. — Access Required" },
      { name: "description", content: "Enter the access code to reach E.D.I.T.H." },
      { property: "og:title", content: "E.D.I.T.H. — Access Required" },
      { property: "og:description", content: "Enter the access code to reach E.D.I.T.H." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Unlock,
});

function Unlock() {
  const router = useRouter();
  const unlock = useServerFn(unlockSite);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const password = new FormData(e.currentTarget).get("password") as string;
    try {
      const { ok } = await unlock({ data: { password } });
      if (ok) await router.navigate({ to: "/" });
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border border-primary/40 rounded-lg p-6 bg-card/60 backdrop-blur">
        <h1 className="text-primary tracking-[0.3em] text-center text-lg">E.D.I.T.H. ACCESS</h1>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Access code"
          className="w-full bg-transparent border border-primary/40 rounded px-3 py-2 text-foreground outline-none focus:border-primary"
        />
        {error && <p className="text-destructive text-sm">Incorrect password</p>}
        <button disabled={busy} type="submit" className="w-full bg-primary text-primary-foreground rounded py-2 tracking-widest disabled:opacity-50">
          {busy ? "VERIFYING…" : "ENTER"}
        </button>
      </form>
    </div>
  );
}
