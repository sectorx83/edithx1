import { describe, expect, it } from "vitest";
import { isValidReportUrl, sanitizeArgs } from "@/lib/styx-network.server";

describe("styx-network sanitizeArgs", () => {
  it("keeps only https URLs for open_website", () => {
    expect(sanitizeArgs("open_website", { url: "https://www.reuters.com" })).toEqual({ url: "https://www.reuters.com" });
    expect(sanitizeArgs("open_website", { url: "http://evil.com" })).toEqual({});
    expect(sanitizeArgs("open_website", { url: "javascript:alert(1)" })).toEqual({});
  });

  it("clamps fetch_page max_chars between 200 and 5000", () => {
    expect(sanitizeArgs("fetch_page", { url: "https://www.bbc.com", max_chars: 50 })).toEqual({ url: "https://www.bbc.com", max_chars: 200 });
    expect(sanitizeArgs("fetch_page", { url: "https://www.bbc.com", max_chars: 99999 })).toEqual({ url: "https://www.bbc.com", max_chars: 5000 });
  });

  it("truncates search_web query and clamps limit", () => {
    const r = sanitizeArgs("search_web", { query: "x".repeat(1000), limit: 50 });
    expect((r["query"] as string).length).toBe(500);
    expect(r["limit"]).toBe(10);
  });

  it("caps execute_task steps at 8 and assigns ids", () => {
    const steps = Array.from({ length: 12 }, () => ({ tool: "fetch_page", args: { url: "https://www.bbc.com" } }));
    const r = sanitizeArgs("execute_task", { steps });
    const out = r["steps"] as { id: string; tool: string }[];
    expect(out.length).toBe(8);
    expect(out[0]!.id).toBe("s1");
    expect(out[0]!.tool).toBe("fetch_page");
  });

  it("drops unknown fields", () => {
    expect(sanitizeArgs("search_web", { query: "hi", evil: true })).toEqual({ query: "hi" });
  });
});

describe("styx-network report URL validation", () => {
  it("accepts the documented report path", () => {
    expect(isValidReportUrl("/api/public/v1/tasks/9d26e9be-502f-4586-ab2a-acc9331c3289/report")).toBe(true);
  });

  it("rejects absolute URLs and other paths", () => {
    expect(isValidReportUrl("https://evil.com/api/public/v1/tasks/9d26e9be-502f-4586-ab2a-acc9331c3289/report")).toBe(false);
    expect(isValidReportUrl("/api/public/v1/command")).toBe(false);
    expect(isValidReportUrl("/api/public/v1/tasks/not-a-uuid/report")).toBe(false);
  });
});
