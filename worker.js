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
    const { topic, tone } = body;

    const model = "@cf/meta/llama-3-8b-instruct";

    const systemPrompt = `
You write cinematic TikTok storytime scripts.
You ALWAYS produce 230–300 words.
You ALWAYS use multiple paragraphs.
You ALWAYS expand the setup, escalation, moment, and reaction.

STRUCTURE:
1. Hook (1–2 sentences)
2. Expanded setup (5–7 sentences)
3. Escalation beat 1
4. Escalation beat 2
5. Escalation beat 3
6. Main moment
7. Emotional reaction
8. Reflective ending line

TONE:
${tone === "direct" ? "Direct and punchy." : ""}
${tone === "hype" ? "High-energy and dramatic." : ""}
${tone === "soft" ? "Soft, emotional, reflective." : ""}
${tone === "story" ? "Cinematic and immersive." : ""}

RULES:
- 230–300 words ONLY.
- No emojis.
- No hashtags.
- No disclaimers.
    `.trim();

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
