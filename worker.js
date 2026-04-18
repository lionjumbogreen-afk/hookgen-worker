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

    // LENGTH RULES — STRICT, NON‑NEGOTIABLE
    function lengthRules(len) {
      if (len === "short") {
        return `
STRICT WORD COUNT:
- 40–60 words ONLY.
- Never exceed 60.
- Never go under 40.

STRUCTURE:
- 1–2 sentence hook
- 1 moment
- 1 reaction
- Fast pacing
        `;
      }

      if (len === "medium") {
        return `
STRICT WORD COUNT:
- 100–140 words ONLY.
- Never exceed 140.
- Never go under 100.

STRUCTURE:
- Hook
- Setup
- Rising tension
- Main moment
- Reaction
        `;
      }

      if (len === "long") {
        return `
STRICT WORD COUNT:
- 160–200 words ONLY.
- Never exceed 200.
- Never go under 160.

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

    // TONE RULES
    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone.";
      if (t === "hype") return "Use a hype, dramatic, high‑energy tone.";
      if (t === "soft") return "Use a soft, emotional, reflective tone.";
      return "Use a cinematic, descriptive story tone.";
    }

    // MODE RULES
    function modeRules(m) {
      if (m === "hook") return "ONLY write the hook. 1–2 sentences. No story.";
      if (m === "cta") return "ONLY write the call‑to‑action. 1–2 sentences. No story.";
      return `
Write a full TikTok story script with:
- Hook paragraph
- Setup paragraph
- Tension paragraph
- Main moment paragraph
- Reaction paragraph
- Ending line paragraph
      `;
    }

    // FINAL SYSTEM PROMPT — FULLY HARDENED
    const systemPrompt = `
You are a TikTok story script generator. You MUST follow every rule below with zero exceptions.

GENERAL RULES (MANDATORY):
- NEVER ignore length rules.
- NEVER shorten or compress the story.
- NEVER exceed or go under the required word count range.
- NEVER stop early or end mid‑sentence.
- ALWAYS finish the full narrative cleanly.
- ALWAYS expand simple topics with sensory detail and pacing.
- ALWAYS follow the structure rules.
- ALWAYS output MULTI‑PARAGRAPH stories (your choice B).
- No emojis. No hashtags. No disclaimers.
- No filler like “Here is your story.”
- No markdown formatting.

LENGTH RULES (MANDATORY):
${lengthRules(length)}

TONE RULES:
${toneRules(tone)}

MODE RULES:
${modeRules(mode)}

COMPLETION RULES (MANDATORY):
- Do NOT end early.
- Do NOT cut off.
- Do NOT stop mid‑sentence.
- If needed, add more detail to reach the required word count.
- The final output MUST be complete, polished, and fully coherent.

If the topic is simple, EXPAND it with vivid detail, emotion, pacing, and atmosphere.
This is non‑negotiable.
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
