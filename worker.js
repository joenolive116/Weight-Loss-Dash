/**
 * Fit 4 The Kingdom — Coach proxy (Cloudflare Worker)
 * ---------------------------------------------------
 * This tiny server keeps your Anthropic API key SECRET. The dashboard (a public
 * website) can't safely hold an API key, so it calls this Worker instead, and the
 * Worker calls Anthropic with the key stored securely on Cloudflare.
 *
 * SETUP (about 5 minutes):
 *  1. Go to https://dash.cloudflare.com  ->  Workers & Pages  ->  Create  ->  Worker.
 *  2. Replace the default code with this whole file, then Deploy.
 *  3. In the Worker's Settings -> Variables -> add a SECRET named:
 *        ANTHROPIC_API_KEY   =  (your key from console.anthropic.com)
 *     Also (recommended) add a plain variable:
 *        ALLOWED_ORIGIN      =  https://YOURNAME.github.io   (your dashboard's URL)
 *  4. Copy the Worker's URL (looks like https://xxxx.workers.dev).
 *  5. Paste that URL into COACH_WORKER_URL near the top of script.js, commit, done.
 *
 * Change MODEL below if you want a smarter (pricier) or cheaper model.
 */

const MODEL = "claude-haiku-4-5-20251001"; // or "claude-sonnet-5" for deeper answers
const MAX_TOKENS = 700;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    const { system, messages } = body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages required" }, 400, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "Server missing ANTHROPIC_API_KEY" }, 500, cors);
    }

    // Keep the conversation from growing without bound.
    const trimmed = messages.slice(-20);

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: typeof system === "string" ? system : undefined,
          messages: trimmed,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return json({ error: data?.error?.message || "Upstream error" }, 502, cors);
      }
      const reply = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return json({ reply: reply || "(no response)" }, 200, cors);
    } catch (e) {
      return json({ error: "Request failed" }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
