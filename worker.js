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

      // Normalize length values so typos don't break logic
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

      // LENGTH RULES — STRICT ENFORCEMENT
      function getLengthInstruction(len) {
        if (len === "short") {
          return `
Write a 15–25 second TikTok story.

STRICT LENGTH RULES:
- 60–90 words.
- Do NOT write fewer than 60 words.
- Count your words and ensure the final output meets the minimum.
- Expand tension or setup if needed.
          `;
        }

        if (len === "medium") {
          return `
Write a 35–45 second TikTok story.

STRICT LENGTH RULES:
- 150–190 words.
- Do NOT write fewer than 150 words.
- Count your words and ensure the final output meets the minimum.
- Add 4–6 sentences of setup.
- Add 3–4 beats of rising tension.
- Add sensory detail (sound, lighting, movement).
- Add internal thoughts to slow pacing.
- Add emotional reactions before AND after the main moment.
- Do NOT compress the story.
          `;
        }

        if (len === "long") {
          return `
Write a 55–65 second cinematic TikTok story.

STRICT LENGTH RULES:
- 200–260 words.
- Do NOT write fewer than 200 words.
- Count your words and ensure the final output meets the minimum.
- Include full setup, tension, escalation, twist, and emotional payoff.
- Add vivid sensory detail and pacing.
          `;
        }

        return "";
      }

      // TONE RULES
      function getToneInstruction(t) {
        if (t === "direct") return "Use a direct, punchy, confident tone.";
        if (t === "hype") return "Use a hype, high-energy, dramatic tone.";
        if (t === "story") return "Use a cinematic, emotional, story-driven tone.";
        if (t === "soft") return "Use a soft, calm, emotional tone.";
        return "";
      }

      // MODE RULES
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

      // Stable model
      const model = "@cf/meta/llama-3-8b-instruct";

      // SYSTEM PROMPT
      const systemPrompt = `
You write TikTok-style cinematic storytime scripts.
Your writing feels human, emotional, visual, and fast-paced.
You avoid robotic or generic AI phrasing.
You write like a creator talking directly to the viewer.
You ONLY output the story.

RULES:
- No emojis.
- No hashtags.
- No disclaimers.
- No commentary.
- No formatting besides the story.
- Follow the length rules EXACTLY.

${getToneInstruction(tone)}
${getLengthInstruction(length)}
${getModeInstruction(mode)}

FORMAT:
### Story:
[story here]
      `.trim();

      // AI CALL
      const aiResponse = await env.AI.run(model, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: topic }
        ]
      });

      const story =
        aiResponse?.response ||
        aiResponse?.result ||
        JSON.stringify(aiResponse);

      // Artificial delay for ad revenue timing
      let delay = 0;

      if (length === "short") delay = 15000;   // 15 seconds
      if (length === "medium") delay = 35000;  // 35 seconds
      if (length === "long") delay = 55000;    // 55 seconds

      await new Promise(resolve => setTimeout(resolve, delay));

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
