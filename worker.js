export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const body = await request.json();
    const { topic, tone, mode } = body;

    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone.";
      if (t === "hype") return "Use a hype, dramatic, high‑energy tone.";
      if (t === "soft") return "Use a soft, emotional, reflective tone.";
      if (t === "tiktok_narrator")
        return "Write in the pacing and cadence of TikTok's default narrator voice: short beats, clear pauses, and clean emphasis.";
      return "Use a cinematic, descriptive story tone.";
    }

    function modeRules(m) {
      if (m === "hook") {
        return `
ONLY write the hook.
1–2 sentences.
No story.
        `;
      }

      if (m === "cta") {
        return `
ONLY write the call‑to‑action.
1–2 sentences.
No story.
        `;
      }

      return `
Write a full TikTok story script.
Target length: 180–220 words.
Use natural paragraph breaks (4–6 paragraphs).
Cinematic pacing with emotional detail.
The ending MUST be complete and resolved. NO cliffhangers.
      `;
    }

    const systemPrompt = `
You are a TikTok story script generator.

MANDATORY RULES:
- Write 180–220 words.
- Use natural paragraph breaks (4–6 paragraphs).
- No emojis. No hashtags. No disclaimers.
- No markdown formatting.
- No filler like "Here is your story."
- Keep pacing cinematic and TikTok‑friendly.

ENDING RULES:
- The story MUST end with a complete, satisfying resolution.
- NO cliffhangers.
- NO open-ended final sentences.

TONE:
${toneRules(tone)}

MODE:
${modeRules(mode)}
    `.trim();

    const model = "@cf/meta/llama-3-8b-instruct";

    const aiResponse = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: topic }
      ]
    });

    const story = aiResponse.response || "";

    return new Response(JSON.stringify({ story }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
