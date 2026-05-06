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

      // Verify signature
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

      // Parse JSON
      const data = JSON.parse(rawBody);
      const event = data.meta.event_name;

      // Handle license creation
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

    // ===============================
// LICENSE VALIDATION (FIXED)
// ===============================
if (url.pathname === "/validate" && request.method === "POST") {
  const body = await request.json();
  const key = body.license;

  const stored = await env.Licenses.get(key, { type: "json" });

  // If no license or not active → invalid
  if (!stored || stored.status !== "active") {
    return new Response(JSON.stringify({ valid: false }), {
      headers: corsHeaders
    });
  }

  // No crash even if activations doesn't exist
  return new Response(JSON.stringify({ valid: true }), {
    headers: corsHeaders
  });
}


    // ============================
    // YOUR /generate ENDPOINT
    // (unchanged — fully preserved)
    // ============================
    if (url.pathname === "/generate") {
      try {
        const body = await request.json();

        const topic = body.topic || "";
        const mode = body.mode || "story";
        const format = body.format || "short";
        const proGen = body.proGen || false;

        const isPro = proGen ? true : false;

        const isHook =
          topic.trim().endsWith("...") ||
          topic.split(" ").length <= 12;

        let hook = "";
        let storyPrompt = "";

        if (mode === "hook") {
          storyPrompt = `
You are generating a dramatic TikTok-style hook.

RULES:
- 1–2 sentences only
- No hashtags
- No jokes unless topic is comedic
- No timestamps
- No "Your Hook:" prefix
- Must feel emotional, mysterious, or urgent
- Must sound like a viral TikTok story opener

Topic: ${topic}
          `;
        }

        if (mode === "story") {
          hook = isHook ? topic : `Generate a viral TikTok hook for this topic: ${topic}`;

          const normalizedFormat =
            format === "line" ? "short" : format;

          let freeSentenceCount =
            normalizedFormat === "short" ? 7 :
            normalizedFormat === "medium" ? 12 :
            normalizedFormat === "long" ? 16 :
            7;

          let proSentenceCount =
            normalizedFormat === "short" ? 10 :
            normalizedFormat === "medium" ? 16 :
            normalizedFormat === "long" ? 22 :
            12;

          if (mode === "suspense") {
            storyPrompt = `
Write a suspenseful TikTok-style story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else if (mode === "emotional") {
            storyPrompt = `
Write an emotional TikTok story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else if (mode === "confession") {
            storyPrompt = `
Write a TikTok confession story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else if (mode === "pov") {
            storyPrompt = `
Write a TikTok POV story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else if (mode === "plottwist") {
            storyPrompt = `
Write a TikTok story with a shocking plot twist.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else if (mode === "mystery") {
            storyPrompt = `
Write a mysterious TikTok story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else if (mode === "comedy") {
            storyPrompt = `
Write a funny TikTok story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else if (mode === "glowup") {
            storyPrompt = `
Write a glow-up TikTok story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else if (isPro && normalizedFormat === "cinematic") {
            storyPrompt = `
Write a cinematic TikTok story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else if (isPro) {
            storyPrompt = `
Write a first-person TikTok story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          else {
            storyPrompt = `
Write a first-person TikTok story.
Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }
        }

        if (mode === "cta") {
          storyPrompt = `
Write a short TikTok CTA.
Topic: ${topic}
          `;
        }

        const ai = env.AI;
        const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [{ role: "user", content: storyPrompt }]
        });

        return new Response(
          JSON.stringify({ story: result.response, isPro }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );

      } catch (err) {
        return new Response(
          JSON.stringify({ error: "generation_failed", details: err.toString() }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
};
