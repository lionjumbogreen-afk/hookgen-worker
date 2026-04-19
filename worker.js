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
        return "Write in the pacing and cadence of TikTok's default narrator voice: short beats, clear pauses, and clean emphasis. Sentences should feel like they are read by the TikTok text‑to‑speech voice.";
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
Write a full TikTok story script with CLEAR paragraph breaks.
4 paragraphs.
Each paragraph 2–3 sentences.
Cinematic pacing.
      `;
    }

    const systemPrompt = `
You are a TikTok story script generator.

RULES:
- Write EXACTLY 4 paragraphs for full stories.
- Each paragraph must have 2–3 sentences.
- No emojis. No hashtags. No disclaimers.
- No markdown formatting.
- No filler like "Here is your story."
- Keep pacing cinematic and TikTok‑friendly.

TONE:
${toneRules(tone)}

MODE:
${modeRules(mode)}

END THE STORY NORMALLY. Do NOT add any markers.
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
