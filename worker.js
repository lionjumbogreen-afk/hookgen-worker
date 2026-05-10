export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Signature, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    // ============================
    // CORS
    // ============================
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ============================
    // WEBHOOK HANDLER
    // ============================
    if (url.pathname === "/webhook" && request.method === "POST") {
      const rawBody = await request.text();
      const signature = request.headers.get("X-Signature");

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(env.LEMON_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signed = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(rawBody)
      );

      const expected = [...new Uint8Array(signed)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      if (expected !== signature) {
        return new Response("Invalid signature", { status: 401 });
      }

      const data = JSON.parse(rawBody);
      const event = data.meta.event_name;

      if (event === "license_key_created") {
        const license = data.data.attributes.key;

        await env.Licenses.put(
          license,
          JSON.stringify({
            status: "active",
            created_at: Date.now()
          })
        );
      }

      return new Response("OK", { status: 200 });
    }

    // ============================
    // LICENSE VALIDATION
    // ============================
    if (url.pathname === "/validate" && request.method === "POST") {
      const body = await request.json();
      const key = body.license;

      const stored = await env.Licenses.get(key, { type: "json" });

      if (!stored || stored.status !== "active") {
        return new Response(JSON.stringify({ valid: false }), {
          headers: corsHeaders
        });
      }

      return new Response(JSON.stringify({ valid: true }), {
        headers: corsHeaders
      });
    }

    // ============================
    // GENERATE ENDPOINT (WITH AUTO‑EXTEND)
    // ============================
    if (url.pathname === "/generate" && request.method === "POST") {
      try {
        const body = await request.json();

        // FRONTEND FIELDS
        const topic = body.topic || "";
        const tone = body.tone || "tiktok_narrator";
        const mode = body.mode || "direct";
        const format = body.format || "short";
        const proGen = body.proGen === true;

        // LICENSE CHECK
        const auth = request.headers.get("Authorization");
        const licenseKey = auth?.replace("Bearer ", "").trim();
        let isPro = false;

        if (licenseKey) {
          const stored = await env.Licenses.get(licenseKey, { type: "json" });
          if (stored && stored.status === "active") {
            isPro = true;
          }
        }

        // HOOK DETECTION
        const isHook =
          topic.trim().endsWith("...") ||
          topic.split(" ").length <= 12;

        const hook = isHook
          ? topic
          : `Generate a viral TikTok hook for this topic: ${topic}`;

        // FORMAT LENGTHS
        const normalizedFormat = format === "line" ? "short" : format;

        const freeSentences =
          normalizedFormat === "short" ? 7 :
          normalizedFormat === "medium" ? 12 :
          normalizedFormat === "long" ? 16 :
          7;

        const proSentences =
          normalizedFormat === "short" ? 10 :
          normalizedFormat === "medium" ? 16 :
          normalizedFormat === "long" ? 22 :
          normalizedFormat === "cinematic" ? 28 :
          12;

        const sentenceCount = isPro ? proSentences : freeSentences;

        // PROMPT BUILDER
        let storyPrompt = `
You are an expert TikTok storyteller.

TONE: ${tone}
MODE: ${mode}
FORMAT: ${normalizedFormat}
PRO USER: ${isPro}

Write a ${sentenceCount}-sentence TikTok story.
Start with this hook EXACTLY:
"${hook}"

Topic: ${topic}

RULES:
- First-person POV
- No hashtags
- No emojis
- No timestamps
- No disclaimers
- Must feel like a viral TikTok story
- Keep pacing tight and emotional
- The story MUST end with a complete sentence.
- Do NOT stop mid-sentence.
- End with a clear emotional conclusion.
`;

        // AI CALL
        const ai = env.AI;
        let result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [{ role: "user", content: storyPrompt }]
        });

        let story = result.response.trim();

        // ============================
        // AUTO‑EXTEND IF STORY ENDS MID‑SENTENCE
        // ============================
        const endsClean =
          story.endsWith(".") ||
          story.endsWith("!") ||
          story.endsWith("?");

        if (!endsClean) {
          const extendPrompt = `
The previous story ended mid-sentence. Continue the story and finish the last sentence. Do NOT restart the story. Do NOT change the tone. Finish it naturally.
Story so far:
${story}
`;

          const extendResult = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [{ role: "user", content: extendPrompt }]
          });

          story += " " + extendResult.response.trim();
        }

        return new Response(
          JSON.stringify({
            story,
            isPro
          }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );

      } catch (err) {
        return new Response(
          JSON.stringify({
            error: "generation_failed",
            details: err.toString()
          }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
};
