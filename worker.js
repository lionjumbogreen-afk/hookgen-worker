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

    // ============================================================
    // /generate — PUBLIC MODE (Free + Pro both work)
    // ============================================================
    if (url.pathname === "/generate") {
      try {
        const body = await request.json();

        const topic = body.topic || "";
        const mode = body.mode || "story";
        const format = body.format || "short";
        const proGen = body.proGen || false;

        // ⭐ PUBLIC MODE: Pro Gen unlocked, but free mode still separate
        const isPro = proGen ? true : false;

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
- No line breaks between sentences
- No dialogue labels
- No script formatting
- No quotes around the whole hook

Topic: ${topic}
          `;
        }

        // ============================
        // STORY MODE (FREE + PRO)
        // ============================
        if (mode === "story") {
          if (isHook) {
            hook = topic;
          } else {
            hook = `Generate a viral TikTok hook for this topic: ${topic}`;
          }

          // FREE LENGTHS
          let freeSentenceCount =
            format === "short" ? 7 :
            format === "medium" ? 12 :
            16;

          // PRO LENGTHS
          let proSentenceCount =
            format === "short" ? 10 :
            format === "medium" ? 16 :
            22;

          // ============================
          // CINEMATIC MODE (PRO ONLY)
          // ============================
          if (isPro && format === "cinematic") {
            storyPrompt = `
You are an expert cinematic storyteller.

Write a long, emotional, dramatic TikTok cinematic story.

STRICT RULES:
- Start with this hook EXACTLY: "${hook}"
- NO timestamps
- NO line-by-line format
- NO dialogue labels
- NO script formatting
- NO bullet points
- NO scene directions
- NO quotes around the whole story
- Write in FIRST PERSON
- Use FULL sentences ONLY
- EXACTLY 4 paragraphs
- EXACTLY 5 sentences per paragraph
- Smooth, emotional, cinematic pacing
- Rich detail, sensory language, deeper emotions
- Story must feel like a movie scene unfolding

Topic: ${topic}
            `;
          }

          // ============================
          // PRO GEN (line mode, short/medium/long)
          // ============================
          else if (isPro) {
            storyPrompt = `
You are an expert TikTok storyteller.

Write a first-person viral TikTok story.

STRICT RULES:
- Start with this hook EXACTLY: "${hook}"
- NO timestamps
- NO line-by-line format
- NO dialogue labels
- NO script formatting
- NO bullet points
- NO scene directions
- NO quotes around the whole story
- Write in FIRST PERSON
- Use FULL sentences ONLY
- EXACTLY ${proSentenceCount} sentences
- Sentences must flow naturally as a real story
- Add richer detail, deeper emotion, and more vivid descriptions

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
- NO line-by-line format
- NO dialogue labels
- NO script formatting
- NO bullet points
- NO scene directions
- NO quotes around the whole story
- Write in FIRST PERSON
- Use FULL sentences ONLY
- EXACTLY ${freeSentenceCount} sentences
- Sentences must flow naturally as a real story
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
