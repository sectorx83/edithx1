import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSystemPrompt } from "@/lib/styx-settings";
import { callChat } from "@/lib/ai.server";
import { sendNetworkCommand, type BrowserAction, type NetworkTaskStep } from "@/lib/styx-network.server";

type Msg = { role: "user" | "assistant"; content: string };

export type NetworkPayload = {
  command: string;
  taskStatus?: string | undefined;
  steps?: { id: string; tool: string; status: string; error?: string | undefined }[] | undefined;
  browserAction?: BrowserAction | undefined;
  reportUrl?: string | undefined;
  actionId?: string | undefined;
  error?: string | undefined;
};

const CMD_RE = /\[STYX_CMD\]([\s\S]*?)\[\/STYX_CMD\]/;

const NETWORK_PROMPT = `
You are connected to the EDITH NETWORK execution engine. When the user asks you to DO one of these things, emit a command directive on its own line, then give a short spoken confirmation:
- Open the live world news / global dashboard ("pull up the latest world news", "world monitor"): [STYX_CMD]{"command":"open_world_news"}[/STYX_CMD]
- Open a website in a new tab: [STYX_CMD]{"command":"open_website","args":{"url":"https://..."}}[/STYX_CMD] (https only, approved news/reference sites)
- Search the web: [STYX_CMD]{"command":"search_web","args":{"query":"..."}}[/STYX_CMD]
- Read/fetch a web page's contents: [STYX_CMD]{"command":"fetch_page","args":{"url":"https://..."}}[/STYX_CMD]
- A multi-step task (e.g. fetch several pages): [STYX_CMD]{"command":"execute_task","args":{"steps":[{"id":"s1","tool":"fetch_page","args":{"url":"https://..."}}]}}[/STYX_CMD] using tools open_world_news, open_website, search_web, fetch_page.
Emit at most one directive per reply. Never invent other commands or fields. If the request does not need these actions, answer normally with no directive.`;

function summarizeSteps(steps: NetworkTaskStep[]): string {
  return steps
    .map((s) => {
      if (s.status === "succeeded" && s.result && typeof s.result === "object") {
        const r = s.result as { title?: string; text?: string; results?: { title?: string; url?: string; snippet?: string }[] };
        if (Array.isArray(r.results)) return r.results.slice(0, 5).map((x) => `${x.title ?? ""} — ${x.snippet ?? x.url ?? ""}`).join("\n");
        if (r.text) return `${r.title ?? "Page"}: ${r.text.slice(0, 900)}`;
      }
      return `${s.tool}: ${s.status}${s.error?.message ? ` (${s.error.message})` : ""}`;
    })
    .join("\n");
}

export const askJarvis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: Msg[] }) => {
    if (!Array.isArray(d?.messages)) throw new Error("Invalid input");
    return { messages: d.messages.slice(-20).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 4000) })) as Msg[] };
  })
  .handler(async ({ data, context }) => {
    const { data: settings } = await context.supabase.from("user_settings").select("tone, sensitive").maybeSingle();
    let out: string;
    try {
      out = await callChat(
        buildSystemPrompt(settings) + "\nThis is primarily a spoken voice conversation: answer in 1-3 short, natural sentences with no markdown, lists, or emojis unless the user asks for detail." + NETWORK_PROMPT,
        data.messages,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "RATE_LIMITED") return { reply: "Systems are throttled, sir. Please try again in a moment." };
      if (msg === "CREDITS_DEPLETED") return { reply: "AI credits are depleted, sir. Please top up to continue." };
      if (msg === "BAD_API_KEY") return { reply: "My Gemini API key appears to be invalid, sir. Please check it in the settings." };
      return { reply: "I'm experiencing a malfunction, sir. Please try again." };
    }

    // Execute a EDITH NETWORK directive if the AI emitted one.
    const match = out.match(CMD_RE);
    let network: NetworkPayload | undefined;
    let reply = out;
    if (match) {
      reply = out.replace(CMD_RE, "").trim();
      try {
        const directive = JSON.parse(match[1]!.trim()) as { command?: string; args?: Record<string, unknown> };
        if (directive.command) {
          const r = await sendNetworkCommand(directive.command, directive.args ?? {});
          network = {
            command: directive.command,
            taskStatus: r.taskStatus,
            steps: r.steps?.map((s) => ({ id: s.id, tool: s.tool, status: s.status, error: s.error?.message })),
            browserAction: r.browserAction,
            reportUrl: r.reportUrl,
            actionId: r.actionId,
            error: r.error,
          };
          if (!r.ok && r.error) {
            reply = `${reply ? reply + " " : ""}The Network reports: ${r.error}`;
          } else if (r.steps?.length) {
            const summary = summarizeSteps(r.steps);
            if (summary && directive.command !== "open_world_news" && directive.command !== "open_website") {
              reply = `${reply ? reply + "\n\n" : ""}${summary}`;
            }
          }
        }
      } catch {
        reply = `${reply ? reply + " " : ""}I could not reach the Network, sir.`;
      }
    }
    return { reply: reply || "...", network };
  });
