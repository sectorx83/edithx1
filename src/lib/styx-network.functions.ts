import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchNetworkTools, reportNetworkAction } from "@/lib/styx-network.server";

export const getNetworkStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    if (!process.env["STYX_NETWORK_API_KEY"]) {
      return { status: "disconnected" as const, error: "API key not configured", tools: [], misconfigured: [], unavailable: [] };
    }
    const r = await fetchNetworkTools();
    if (!r.ok) return { status: "disconnected" as const, error: r.error, tools: [], misconfigured: [], unavailable: [] };
    return {
      status: "connected" as const,
      tools: r.tools.map((t) => ({ name: t.name, description: t.description ?? "" })),
      misconfigured: r.misconfigured.map((t) => ({ name: t.name, reason: t.availability?.reason ?? "Misconfigured", setup: t.availability?.setup ?? "" })),
      unavailable: r.unavailable.map((t) => ({ name: t.name, reason: t.availability?.reason ?? "Unavailable" })),
    };
  });

export const reportBrowserAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportUrl: string; actionId: string; success: boolean }) => {
    if (typeof d?.reportUrl !== "string" || typeof d?.actionId !== "string" || typeof d?.success !== "boolean") {
      throw new Error("Invalid input");
    }
    return { reportUrl: d.reportUrl, actionId: d.actionId, success: d.success };
  })
  .handler(async ({ data }) => {
    return reportNetworkAction(data.reportUrl, data.actionId, data.success);
  });
