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

STRUCTURE:
- 1 paragraph
- 2–4 sentences
- Hook → moment → reaction
        `;
      }

      if (len === "medium") {
        return `
STRICT WORD COUNT:
- 100–140 words ONLY.

STRUCTURE:
- 3–4 paragraphs
- 6–10 sentences total
- Hook → setup → tension → moment/reaction
        `;
      }

      if (len === "long") {
        return `
STRICT WORD COUNT:
- 160–200 words ONLY.

STRICT PARAGRAPH COUNT:
- EXACTLY 6 paragraphs.
- Each paragraph MUST be 25–35 words.
- Each paragraph MUST contain 2–3 sentences.

STRUCTURE:
- Paragraph 1: Hook
- Paragraph 2: Expanded setup
- Paragraph 3: Escalation 1
- Paragraph 4: Escalation 2
- Paragraph 5: Main moment
- Paragraph 6: Reaction / closing
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
      if (m === "hook") {
        return `
ONLY write the hook.
- 1–2 sentences.
- No story.
        `;
      }

      if (m === "cta") {
        return `
ONLY write the call‑to‑action.
- 1–2 sentences.
- No story.
        `;
      }

      return `
Write a full TikTok story script with CLEAR paragraph breaks.
      `;
    }

    // FINAL SYSTEM PROMPT — FULLY HARDENED
    const systemPrompt = `
You are a TikTok story script generator. You MUST follow every rule below with zero exceptions.

GLOBAL RULES (MANDATORY):
- NEVER ignore length rules.
- NEVER exceed or go under the required word count.
- NEVER stop early.
- NEVER end mid‑sentence.
- ALWAYS finish the full narrative.
- ALWAYS expand simple topics with sensory detail.
- ALWAYS output MULTIPLE PARAGRAPHS for full stories.
- No emojis. No hashtags. No disclaimers.
- No markdown formatting.
- No filler like "Here is your story."

LENGTH RULES:
${lengthRules(length)}

TONE RULES:
${toneRules(tone)}

MODE RULES:
${modeRules(mode)}

ANTI‑CUTOFF RULES (MANDATORY):
- The story MUST end with a complete final paragraph.
- The story MUST internally end with the hidden marker: [END OF STORY]
- DO NOT show the marker to the user.
- DO NOT stop before the marker.
- If the story is not long enough, EXPAND BEFORE writing the marker.
- If the story has fewer than the required paragraphs, KEEP WRITING.
- If the story has fewer than the required sentences, KEEP WRITING.
- If the story has fewer than the required words, KEEP WRITING.

OUTPUT FORMAT:
- Plain text only.
- Paragraphs separated by a SINGLE newline (no blank line).
- Final output MUST end with "[END OF STORY]" on its own line.

This is non‑negotiable.
    `.trim();

    const model = "@cf/meta/llama-3-8b-instruct";

    const aiResponse = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: topic }
      ]
    });

    let story = aiResponse.response;

    // REMOVE the hidden marker before sending to frontend
    story = story.replace(/

\[END OF STORY\]

/g, "").trim();

    return new Response(JSON.stringify({ story }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
