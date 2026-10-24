// Server-only client for the STYX NETWORK execution engine.
// Never import this file from client code.

export const NETWORK_BASE = "https://styx-network.lovable.app";

export type NetworkTool = {
  name: string;
  description?: string;
  availability?: { status: string; reason?: string; setup?: string };
};

export type NetworkToolsResult =
  | { ok: true; tools: NetworkTool[]; misconfigured: NetworkTool[]; unavailable: NetworkTool[] }
  | { ok: false; error: string };

export type BrowserAction = {
  action: string;
  url: string;
  target?: string;
  display_mode?: string;
};

export type NetworkTaskStep = {
  id: string;
  tool: string;
  status: string;
  error?: { code?: string; message?: string } | null;
  result?: unknown;
  browser_action?: BrowserAction | null;
};

export type NetworkCommandResult = {
  ok: boolean;
  error?: string | undefined;
  taskStatus?: string | undefined;
  steps?: NetworkTaskStep[] | undefined;
  browserAction?: BrowserAction | undefined;
  reportUrl?: string | undefined;
  actionId?: string | undefined;
  failureReason?: string | undefined;
};

function getKey(): string {
  const key = process.env["STYX_NETWORK_API_KEY"];
  if (!key) throw new Error("STYX_NETWORK_API_KEY is not configured");
  return key;
}

async function networkFetch(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(`${NETWORK_BASE}${path}`, {
      ...init,
      signal: ac.signal,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${getKey()}`,
        "Content-Type": "application/json",
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchNetworkTools(): Promise<NetworkToolsResult> {
  try {
    const res = await networkFetch("/api/public/v1/tools", { method: "GET" }, 8000);
    if (!res.ok) return { ok: false, error: `Network returned ${res.status}` };
    const d = (await res.json()) as {
      ok?: boolean;
      tools?: NetworkTool[];
      misconfigured_tools?: NetworkTool[];
      unavailable_tools?: NetworkTool[];
    };
    if (!d.ok) return { ok: false, error: "Network rejected the request" };
    return {
      ok: true,
      tools: d.tools ?? [],
      misconfigured: d.misconfigured_tools ?? [],
      unavailable: d.unavailable_tools ?? [],
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "AbortError" ? "Connection timed out" : "Network unreachable" };
  }
}

const ALLOWED_COMMANDS = new Set(["open_world_news", "open_website", "search_web", "fetch_page", "execute_task"]);

export function isValidReportUrl(reportUrl: string): boolean {
  return /^\/api\/public\/v1\/tasks\/[0-9a-f-]{36}\/report$/i.test(reportUrl);
}

export function sanitizeArgs(command: string, args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (command === "open_website" || command === "fetch_page") {
    const url = args["url"];
    if (typeof url === "string" && /^https:\/\//i.test(url)) out["url"] = url.slice(0, 2000);
    const maxChars = args["max_chars"];
    if (command === "fetch_page" && typeof maxChars === "number") out["max_chars"] = Math.min(Math.max(200, maxChars), 5000);
  } else if (command === "search_web") {
    const query = args["query"];
    if (typeof query === "string") out["query"] = query.slice(0, 500);
    const limit = args["limit"];
    if (typeof limit === "number") out["limit"] = Math.min(Math.max(1, limit), 10);
  } else if (command === "execute_task") {
    const steps = args["steps"];
    if (Array.isArray(steps)) {
      out["steps"] = steps.slice(0, 8).map((s: Record<string, unknown>, i: number) => {
        const id = s?.["id"];
        const tool = s?.["tool"];
        const sArgs = s?.["args"];
        const deps = s?.["depends_on"];
        return {
          id: typeof id === "string" ? id.slice(0, 40) : `s${i + 1}`,
          tool: typeof tool === "string" ? tool : "",
          args: typeof sArgs === "object" && sArgs ? sArgs : {},
          ...(Array.isArray(deps) ? { depends_on: deps.slice(0, 8) } : {}),
        };
      });
    }
  }
  return out;
}

export async function sendNetworkCommand(command: string, args: Record<string, unknown>): Promise<NetworkCommandResult> {
  if (!ALLOWED_COMMANDS.has(command)) return { ok: false, error: `Unknown command: ${command}` };
  try {
    const res = await networkFetch(
      "/api/public/v1/command",
      { method: "POST", body: JSON.stringify({ command, args: sanitizeArgs(command, args) }) },
      30000,
    );
    type CommandResponse = {
      ok?: boolean;
      error?: { message?: string };
      task?: { task_id?: string; status?: string; failure_reason?: string; plan?: NetworkTaskStep[] };
      execution?: { report_url?: string; action_id?: string };
      browser_action?: BrowserAction;
      browser_actions?: BrowserAction[];
    };
    const d = (await res.json().catch(() => null)) as CommandResponse | null;
    if (!d) return { ok: false, error: `Network returned ${res.status}` };
    const task = d.task;
    const execution = d.execution;
    const browserAction = d.browser_action ?? d.browser_actions?.[0];
    const steps = task?.plan ?? [];
    if (d.ok === false && !task) {
      return { ok: false, error: d.error?.message ?? "Command rejected" };
    }
    return {
      ok: d.ok === true,
      taskStatus: task?.status,
      steps: steps.map((s) => ({ id: s.id, tool: s.tool, status: s.status, error: s.error ?? null, result: s.result ?? null, browser_action: s.browser_action ?? null })),
      browserAction: browserAction ?? steps.find((s) => s.browser_action)?.browser_action ?? undefined,
      reportUrl: execution?.report_url ?? (task?.task_id ? `/api/public/v1/tasks/${task.task_id}/report` : undefined),
      actionId: execution?.action_id ?? "main",
      failureReason: task?.failure_reason,
      error: d.ok === false ? (d.error?.message ?? task?.failure_reason ?? "Command failed") : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "AbortError" ? "Network request timed out" : "Network unreachable" };
  }
}

export async function reportNetworkAction(reportUrl: string, actionId: string, success: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!isValidReportUrl(reportUrl)) return { ok: false, error: "Invalid report URL" };
  try {
    const res = await networkFetch(reportUrl, { method: "POST", body: JSON.stringify({ action_id: actionId, success }) }, 10000);
    const d = (await res.json().catch(() => null)) as { ok?: boolean; error?: { code?: string; message?: string } } | null;
    if (d?.ok) return { ok: true };
    return { ok: false, error: d?.error?.message ?? `Report failed (${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "AbortError" ? "Report timed out" : "Network unreachable" };
  }
}
