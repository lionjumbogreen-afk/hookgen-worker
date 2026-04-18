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

      // Normalize length just in case
      length = (length || "").toLowerCase().trim();
      if (length === "short " || length === "Short") length = "short";
      if (length === "medium " || length === "Medium") length = "medium";
      if (length === "long " || length === "Long") length = "long";

      function getLengthInstruction(len) {
        if (len === "short") {
          return `
Write a SHORT TikTok story.

STRICT LENGTH:
- 35–50 words ONLY.
- DO NOT exceed 50 words.
- DO NOT write fewer than 35 words.

STRUCTURE:
- ONE scene only.
- ONE main moment.
- ONE reaction.
- NO long setup.
- NO reflection paragraphs.
- NO multiple paragraphs.
- Keep sentences short and direct.
          `;
        }

        if (len === "medium") {
          return `
Write a MEDIUM TikTok story.

LENGTH:
- 120–170 words.
- Do NOT write fewer than 120 words.
- Do NOT exceed 170 words.

STRUCTURE:
- Hook in the first 1–2 sentences.
- Brief setup.
- Rising tension.
- One main moment.
- Short reaction and ending line.
          `;
        }

        if (len === "long") {
          return `
Write a LONG TikTok story.

LENGTH:
- 220–260 words.
- Do NOT write fewer than 220 words.
- Do NOT exceed 260 words.

STRUCTURE:
- Strong hook.
- Clear setup.
- Escalation with 2–3 beats.
- Main moment.
- Emotional reaction.
- Satisfying closing line.
          `;
        }

        return `
Write a TikTok story with clear pacing.
If no length is specified, aim for 140–180 words.
        `;
      }

      function getToneInstruction(t) {
        if (!t) return "";
        t = String(t).toLowerCase();
        if (t === "direct") return "Use a direct, punchy, confident tone.";
        if (t === "hype") return "Use a hype, high-energy, dramatic tone.";
        if (t === "story") return "Use a cinematic, emotional, story-driven tone.";
        if (t === "soft") return "Use a soft, calm, emotional tone.";
        return "";
      }

      function getModeInstruction(m) {
        if (!m) return "";
        m = String(m).toLowerCase();
        if (m === "hook") {
          return `
ONLY write the hook.
- 1–2 sentences.
- No full story.
          `;
        }
        if (m === "cta") {
          return `
ONLY write the call-to-action.
- 1–2 sentences.
- Speak directly to the viewer.
          `;
        }
        return `
Write a full TikTok story script with:
- Hook
- Setup
- Rising tension
- Main moment
- Reaction
- Ending line
        `;
      }

      const model = "@cf/meta/llama-3-8b-instruct";

      const systemPrompt = `
You write TikTok-style cinematic storytime scripts.
You speak like a creator talking directly to the viewer.
You ONLY output the story text.

RULES:
- No emojis.
- No hashtags.
- No disclaimers.
- No commentary about being an AI.
- Follow the length and structure instructions exactly.

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
