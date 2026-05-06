export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Signature, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/generate") {
      try {
        const body = await request.json();

        const topic = body.topic || "";
        const mode = body.mode || "story";
        const format = body.format || "short";
        const proGen = body.proGen || false;

        // ⭐ PUBLIC MODE: Pro Gen unlocked
        const isPro = proGen ? true : false;

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

Topic: ${topic}
          `;
        }

        // ============================
        // STORY MODE
        // ============================
        if (mode === "story") {
          hook = isHook ? topic : `Generate a viral TikTok hook for this topic: ${topic}`;

          // ⭐ FIX: handle "line" format
          const normalizedFormat =
            format === "line" ? "short" : format;

          // FREE LENGTHS
          let freeSentenceCount =
            normalizedFormat === "short" ? 7 :
            normalizedFormat === "medium" ? 12 :
            normalizedFormat === "long" ? 16 :
            7;

          // PRO LENGTHS
          let proSentenceCount =
            normalizedFormat === "short" ? 10 :
            normalizedFormat === "medium" ? 16 :
            normalizedFormat === "long" ? 22 :
            12;

          // ============================
          // CINEMATIC MODE (PRO ONLY)
          // ============================
          if (isPro && normalizedFormat === "cinematic") {
            storyPrompt = `
You are an expert cinematic storyteller.

Write a long, emotional, dramatic TikTok cinematic story.

STRICT RULES:
- Start with this hook EXACTLY: "${hook}"
- NO timestamps
- NO line-by-line format
- Write in FIRST PERSON
- EXACTLY 4 paragraphs
- EXACTLY 5 sentences per paragraph

Topic: ${topic}
            `;
          }

          // ============================
          // PRO GEN (line mode + short/medium/long)
          // ============================
          else if (isPro) {
            storyPrompt = `
You are an expert TikTok storyteller.

Write a first-person viral TikTok story.

STRICT RULES:
- Start with this hook EXACTLY: "${hook}"
- NO timestamps
- Write in FIRST PERSON
- EXACTLY ${proSentenceCount} sentences
- Add richer detail, deeper emotion, and vivid descriptions

Topic: ${topic}
            `;
          }

          // ============================
          // FREE MODE
          // ============================
          else {
            storyPrompt = `
You are an expert TikTok storyteller.

Write a first-person viral TikTok story.

STRICT RULES:
- Start with this hook EXACTLY: "${hook}"
- NO timestamps
- Write in FIRST PERSON
- EXACTLY ${freeSentenceCount} sentences
- Make it dramatic and smooth

Topic: ${topic}
            `;
          }
        }

        // ============================
        // CTA MODE
        // ============================
        if (mode === "cta") {
          storyPrompt = `
Write a short TikTok CTA based on this topic.

Rules:
- 1–2 lines
- No timestamps

Topic: ${topic}
          `;
        }

        // ============================
        // RUN AI
        // ============================
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
