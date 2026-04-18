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
- 1 main moment
- 1 reaction
- Fast pacing
- 2–4 sentences total
        `;
      }

      if (len === "medium") {
        return `
STRICT WORD COUNT:
- 100–140 words ONLY.
- Never exceed 140.
- Never go under 100.

STRUCTURE:
- Hook paragraph
- Setup paragraph
- Tension paragraph
- Main moment + reaction paragraph
- 6–10 sentences total
        `;
      }

      if (len === "long") {
        return `
STRICT WORD COUNT:
- 160–200 words ONLY.
- Never exceed 200.
- Never go under 160.

STRUCTURE:
- Hook paragraph
- Expanded setup paragraph
- Escalation paragraph 1
- Escalation paragraph 2
- Main moment + emotional reaction paragraph
- Final closing paragraph
- 8–14 sentences total

FINAL SENTENCE (MANDATORY FOR LONG STORIES):
- The very last sentence of the story MUST be exactly:
  "But that was only the beginning."
        `;
      }

      return `
Write a 120–150 word TikTok story with:
- Clear beginning, middle, and end.
- No markdown.
- No filler.
      `;
    }

    // TONE RULES
    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone with short, impactful sentences.";
      if (t === "hype") return "Use a hype, dramatic, high‑energy tone with intense pacing.";
      if (t === "soft") return "Use a soft, emotional, reflective tone with gentle pacing.";
      return "Use a cinematic, descriptive story tone with vivid imagery.";
    }

    // MODE RULES
    function modeRules(m) {
      if (m === "hook") {
        return `
ONLY write the hook.
- 1–2 sentences.
- No full story.
- No CTA.
- No extra commentary.
        `;
      }

      if (m === "cta") {
        return `
ONLY write the call‑to‑action.
- 1–2 sentences.
- Speak directly to the viewer.
- No story content.
        `;
      }

      return `
Write a full TikTok story script with CLEAR paragraphs:
- Hook paragraph
- Setup paragraph
- Tension paragraph
- Main moment paragraph
- Reaction / reflection paragraph
- Ending line paragraph
      `;
    }

    // FINAL SYSTEM PROMPT — FULLY HARDENED
    const systemPrompt = `
You are a TikTok story script generator. You MUST follow every rule below with zero exceptions.

GLOBAL RULES (MANDATORY):
- NEVER ignore length rules.
- NEVER shorten or compress the story.
- NEVER exceed or go under the required word count range.
- NEVER stop early or end mid‑sentence.
- ALWAYS finish the full narrative cleanly.
- ALWAYS expand simple topics with sensory detail, pacing, and emotion.
- ALWAYS follow the structure rules.
- ALWAYS output MULTI‑PARAGRAPH stories (blank line between paragraphs) for full stories.
- No emojis. No hashtags. No disclaimers.
- No filler like "Here is your story."
- No markdown formatting (no bullets, no headings, no asterisks).

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
- The story MUST have a clear ending.
- For LONG stories, the final sentence MUST be exactly:
  "But that was only the beginning."
- If needed, add more detail, pacing, or emotional beats to reach the required word count range BEFORE ending.

OUTPUT FORMAT:
- Plain text only.
- For full stories: multiple paragraphs separated by blank lines.
- For hook/cta modes: 1 short paragraph only.

If the topic is simple, EXPAND it with vivid detail, atmosphere, and emotional stakes.
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
