import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function cfg() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "styx-gate",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const isUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  const s = await useSession<GateSession>(cfg());
  return { unlocked: !!s.data.unlocked };
});

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: String(d?.password ?? "").slice(0, 200) }))
  .handler(async ({ data }) => {
    const expected = process.env["SITE_PASSWORD"];
    if (!expected) throw new Error("SITE_PASSWORD is not set");
    if (!matches(data.password, expected)) return { ok: false as const };
    const s = await useSession<GateSession>(cfg());
    await s.update({ unlocked: true });
    return { ok: true as const };
  });
