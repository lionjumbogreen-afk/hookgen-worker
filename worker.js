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
      const { topic, tone, length, mode } = await request.json();

      // LENGTH RULES — STRICT ENFORCEMENT
      function getLengthInstruction(len) {
        if (len === "short") {
          return `
Write a 15–20 second TikTok story.

LENGTH RULES (STRICT):
- 45–65 words
- Do NOT write fewer than 45 words.
- Count your words and ensure the final output meets the minimum.
- Expand the setup or tension if needed to reach the length.
          `;
        }

        if (len === "medium") {
          return `
Write a 30–45 second TikTok story.

LENGTH RULES (STRICT):
- 150–180 words
- Do NOT write fewer than 150 words.
- Count your words and ensure the final output meets the minimum.
- Expand the setup, tension, sensory detail, and emotional beats.
- Add 2–3 extra moments of internal thought.
- Add more buildup before the main moment.
- Slow the pacing intentionally.
- Do NOT compress the story.
          `;
        }

        if (len === "long") {
          return `
Write a 55–65 second cinematic TikTok story.

LENGTH RULES (STRICT):
- 180–220 words
- Do NOT write fewer than 180 words.
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

      // Single, stable model
      const model = "@cf/meta/llama-3-8b-instruct";

      // SYSTEM PROMPT
      const systemPrompt = `
You write TikTok-style cinematic storytime scripts.
Your writing feels human, emotional, visual, and fast-paced.
You avoid robotic or generic AI phrasing.
You write like a creator talking directly to the viewer.
You use tension, sensory detail, and natural pacing.
You avoid advice, motivation, or commentary.
You ONLY output the story.

RULES:
- No emojis.
- No hashtags.
- No disclaimers.
- No commentary.
- No extra formatting besides the story.
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

      // Artificial delay to help with ad impressions (about 8 seconds)
      await new Promise(resolve => setTimeout(resolve, 8000));

      // SUCCESS RESPONSE
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
      // ERROR RESPONSE (with CORS so browser can see it)
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

