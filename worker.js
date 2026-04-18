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
SHORT STORY
STRICT LENGTH:
- 40–60 words ONLY.
- Do NOT exceed 60 words.
- Do NOT go under 40 words.

STRUCTURE:
- 1–2 sentence hook
- 1 moment
- 1 reaction
- Fast pacing
        `;
      }

      if (len === "medium") {
        return `
MEDIUM STORY
STRICT LENGTH:
- 100–140 words ONLY.
- Do NOT exceed 140 words.
- Do NOT go under 100 words.

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
LONG STORY
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

    // TONE RULES
    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone.";
      if (t === "hype") return "Use a hype, dramatic tone.";
      if (t === "soft") return "Use a soft, emotional tone.";
      return "Use a cinematic story tone.";
    }

    // MODE RULES
    function modeRules(m) {
      if (m === "hook") return "ONLY write the hook. 1–2 sentences. No story.";
      if (m === "cta") return "ONLY write the call-to-action. 1–2 sentences. No story.";
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

    // FINAL SYSTEM PROMPT — THE REAL FIX
    const systemPrompt = `
You are a TikTok story script generator. You MUST follow every rule below with zero exceptions.

GENERAL RULES (MANDATORY):
- NEVER ignore length rules.
- NEVER shorten or compress the story.
- NEVER exceed or go under the required word count range.
- NEVER summarize — always write a full narrative.
- ALWAYS expand simple topics with sensory detail.
- ALWAYS follow the structure rules.
- No emojis. No hashtags. No disclaimers.
- No filler like “Here is your story.”

LENGTH RULES (MANDATORY):
${lengthRules(length)}

TONE RULES:
${toneRules(tone)}

MODE RULES:
${modeRules(mode)}

If the topic is simple, EXPAND it with pacing, emotion, and vivid detail.
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
