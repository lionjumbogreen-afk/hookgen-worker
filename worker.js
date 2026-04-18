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
    const { topic, tone, length, mode } = body;

    function lengthRules(len) {
      if (len === "short") {
        return `
SHORT STORY (15–20 seconds)
STRICT LENGTH:
- 40–60 words ONLY.
- Do NOT exceed 60 words.
- Do NOT go under 40 words.

STRUCTURE:
- 1–2 sentence hook
- 1 moment
- 1 reaction
- No reflection
- No long buildup
- Keep it fast and punchy
        `;
      }

      if (len === "medium") {
        return `
MEDIUM STORY (35–45 seconds)
STRICT LENGTH:
- 100–140 words ONLY.
- Do NOT exceed 140 words.
- Do NOT go under 100 words.

STRUCTURE:
- Hook
- Brief setup
- Rising tension
- Main moment
- Short reaction
        `;
      }

      if (len === "long") {
        return `
LONG STORY (55–65 seconds)
STRICT LENGTH:
- 160–200 words ONLY.
- Do NOT exceed 200 words.
- Do NOT go under 160 words.

STRUCTURE:
- Hook
- Expanded setup
- Escalation beat 1
- Escalation beat 2
- Main moment
- Emotional reaction
- Closing line
        `;
      }

      return "Write a 120–150 word TikTok story.";
    }

    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone.";
      if (t === "hype") return "Use a hype, dramatic tone.";
      if (t === "soft") return "Use a soft, emotional tone.";
      return "Use a cinematic story tone.";
    }

    function modeRules(m) {
      if (m === "hook") return "ONLY write the hook. 1–2 sentences.";
      if (m === "cta") return "ONLY write the call-to-action. 1–2 sentences.";
      return `
Write a full TikTok story script with:
- Hook
- Setup
- Tension
- Main moment
- Reaction
- Ending line
      `;
    }

    const systemPrompt = `
You write TikTok storytime scripts.
Follow ALL rules exactly.
No emojis. No hashtags. No disclaimers.

${toneRules(tone)}
${lengthRules(length)}
${modeRules(mode)}
    `.trim();

    const model = "@cf/meta/llama-3-8b-instruct";

    const aiResponse = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: topic }
      ]
    });

    const story = aiResponse.response;

    return new Response(JSON.stringify({ story }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
