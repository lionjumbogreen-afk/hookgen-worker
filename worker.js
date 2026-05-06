export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Signature",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ============================================================
    // /generate — HOOK, STORY, CTA
    // ============================================================
    if (url.pathname === "/generate") {
      try {
        const body = await request.json();

        const topic = body.topic || "";
        const tone = body.tone || "tiktok_narrator";
        const mode = body.mode || "story";
        const format = body.format || "short";

        // Detect if user input is already a hook
        const isHook =
          topic.trim().endsWith("...") ||
          topic.split(" ").length <= 12;

        let hook = "";
        let storyPrompt = "";

        // ============================
        // HOOK MODE
        // ============================
        if (mode === "hook") {
          storyPrompt = `
Turn the topic below into a viral TikTok hook.

Rules:
- 1–2 sentences only
- No story
- No timestamps
- No dialogue labels
- No quotes around the whole hook

Topic: ${topic}
          `;
        }

        // ============================
        // STORY MODE
        // ============================
        if (mode === "story") {
          if (isHook) {
            hook = topic;
          } else {
            hook = `Generate a viral TikTok hook for this topic: ${topic}`;
          }

          const sentenceCount =
            format === "short" ? 7 :
            format === "medium" ? 12 :
            16;

          storyPrompt = `
You are an expert TikTok storyteller.

Write a first-person viral TikTok story.

Rules:
- Start with this hook EXACTLY: "${hook}"
- No timestamps
- No "Me:"
- No script formatting
- No quotes around the whole story
- Write in FIRST PERSON
- Make it dramatic and fast-paced
- Use FULL sentences
- EXACTLY ${sentenceCount} sentences

Topic: ${topic}
          `;
        }

        // ============================
        // CTA MODE
        // ============================
        if (mode === "cta") {
          storyPrompt = `
Write a short TikTok CTA based on this topic.

Rules:
- 1–2 lines
- No story
- No timestamps
- No quotes around the whole CTA

Topic: ${topic}
          `;
        }

        // ============================
        // RUN CLOUDFLARE AI
        // ============================
        const ai = env.AI;
        const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "user", content: storyPrompt }
          ]
        });

        return new Response(
          JSON.stringify({ story: result.response }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );

      } catch (err) {
        return new Response(
          JSON.stringify({ error: "generation_failed", details: err.toString() }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // ============================================================
    // RAW BODY READER (for webhook signature)
    // ============================================================
    async function readRawBody(req) {
      const reader = req.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const length = chunks.reduce((a, c) => a + c.length, 0);
      const merged = new Uint8Array(length);

      let offset = 0;
      for (let chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      return merged;
    }

    // ============================================================
    // /webhook — Lemon Squeezy License Webhook
    // ============================================================
    if (url.pathname === "/webhook") {
      const rawBody = await readRawBody(request);
      const bodyText = new TextDecoder().decode(rawBody);

      const signature = request.headers.get("X-Signature") || "";
      if (!signature) {
        return new Response("Missing signature", { status: 400, headers: corsHeaders });
      }

      function hexToUint8(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return bytes;
      }

      let signatureBytes;
      try {
        signatureBytes = hexToUint8(signature);
      } catch {
        return new Response("Bad signature format", { status: 400, headers: corsHeaders });
      }

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(env.LEMON_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const isValid = await crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        signatureBytes,
        rawBody
      ).catch(() => false);

      if (!isValid) {
        return new Response("Invalid signature", { status: 401, headers: corsHeaders });
      }

      let data;
      try {
        data = JSON.parse(bodyText);
      } catch {
        return new Response("Bad JSON", { status: 400, headers: corsHeaders });
      }

      const event = data?.meta?.event_name || "";
      if (event !== "license_key_created" && event !== "license_key_updated") {
        return new Response("Ignored", { status: 200, headers: corsHeaders });
      }

      const licenseKey = data?.data?.attributes?.key || "";
      const status =
        event === "license_key_created"
          ? "active"
          : data?.data?.attributes?.status;

      if (licenseKey) {
        const record = {
          status,
          activations: []
        };
        await env.LICENSES.put(licenseKey, JSON.stringify(record));
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ============================================================
    // /activate — 3 DEVICE LIMIT
    // ============================================================
    if (url.pathname === "/activate") {
      const body = await request.json();
      const { licenseKey, deviceId } = body;

      if (!licenseKey || !deviceId) {
        return new Response(
          JSON.stringify({ ok: false, error: "missing_fields" }),
          { headers: corsHeaders }
        );
      }

      const raw = await env.LICENSES.get(licenseKey);
      if (!raw) {
        return new Response(
          JSON.stringify({ ok: false, error: "license_not_found" }),
          { headers: corsHeaders }
        );
      }

      const record = JSON.parse(raw);

      if (record.status !== "active") {
        return new Response(
          JSON.stringify({ ok: false, error: "inactive_license" }),
          { headers: corsHeaders }
        );
      }

      const activations = record.activations || [];

      if (activations.some(a => a.deviceId === deviceId)) {
        return new Response(
          JSON.stringify({
            ok: true,
            isPro: true,
            devicesUsed: activations.length,
            devicesAllowed: 3
          }),
          { headers: corsHeaders }
        );
      }

      if (activations.length >= 3) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "activation_limit",
            message: "This license is already activated on 3 devices."
          }),
          { headers: corsHeaders }
        );
      }

      activations.push({
        deviceId,
        timestamp: Date.now()
      });

      record.activations = activations;

      await env.LICENSES.put(licenseKey, JSON.stringify(record));

      return new Response(
        JSON.stringify({
          ok: true,
          isPro: true,
          devicesUsed: activations.length,
          devicesAllowed: 3
        }),
        { headers: corsHeaders }
      );
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
};

