export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Only POST allowed", {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const body = await request.json();
      let { topic, tone, length, mode } = body;

      // Normalize length
      length = (length || "").toLowerCase().trim();
      if (["med", "medo", "medoum", "medium ", "Medium"].includes(length)) {
        length = "medium";
      }
      if (["short ", "Short"].includes(length)) {
        length = "short";
      }
      if (["long ", "Long"].includes(length)) {
        length = "long";
      }

      function getLengthInstruction(len) {
       if (len === "short") {
  return `
Write a SHORT TikTok story.

STRICT RULES:
- 35–50 words ONLY.
- DO NOT exceed 50 words.
- ONE scene only.
- ONE moment only.
- ONE reaction only.
- NO long setup.
- NO emotional reflection.
- NO multiple paragraphs.
- Keep sentences short and direct.
- Count your words before outputting.
  `;
}

        if (len === "medium") {
          return `
Write a medium TikTok story.

LENGTH:
- 150–190 words.
- Do NOT write fewer than 150 words.
- Count your words.
- Use a clear setup, rising tension, main moment, and reaction.
          `;
        }

        if (len === "long") {
          return `
Write a long TikTok story.

LENGTH:
- 220–260 words.
- Do NOT write fewer than 220 words.
- Count your words.
- Include full setup, escalation, main moment, and emotional payoff.
          `;
        }

        return "";
      }

      function getToneInstruction(t) {
        if (t === "direct") return "Use a direct, punchy, confident tone.";
        if (t === "hype") return "Use a hype, high-energy, dramatic tone.";
        if (t === "story") return "Use a cinematic, emotional, story-driven tone.";
        if (t === "soft") return "Use a soft, calm, emotional tone.";
        return "";
      }

      function getModeInstruction(m) {
        if (m === "hook") return "ONLY write the hook. 1–2 sentences max.";
        if (m === "cta") return "ONLY write the call-to-action. 1–2 sentences.";
        return `
Write a full TikTok story script with:
- Hook
- Setup
- Rising tension
- Main moment
- Emotional reaction
- Ending line
        `;
      }

      const model = "@cf/meta/llama-3-8b-instruct";

      const systemPrompt = `
You write TikTok-style cinematic storytime scripts.
Your writing feels human, emotional, visual, and fast-paced.
You write like a creator talking directly to the viewer.
You ONLY output the story text.

RULES:
- No emojis.
- No hashtags.
- No disclaimers.
- No commentary.
- Follow the length instructions.

${getToneInstruction(tone)}
${getLengthInstruction(length)}
${getModeInstruction(mode)}
      `.trim();

      const aiResponse = await env.AI.run(model, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: topic || "" }
        ]
      });

      const story =
        aiResponse?.response ||
        aiResponse?.result ||
        JSON.stringify(aiResponse);

      // Fixed delays: short 20s, medium 40s, long 60s
      let delay = 0;
      if (length === "short") delay = 20000;
      if (length === "medium") delay = 40000;
      if (length === "long") delay = 60000;

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return new Response(
        JSON.stringify({ story }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({
          error: true,
          message: err?.message || String(err)
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }
  }
};
