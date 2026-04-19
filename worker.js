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
STRICT WORD COUNT:
- 40–60 words ONLY.

STRUCTURE:
- EXACTLY 1 paragraph.
- 2–4 sentences.
- Hook → moment → reaction.

ENFORCEMENT:
- If under 40 words, KEEP WRITING.
- If over 60 words, REWRITE until correct.
        `;
      }

      if (len === "medium") {
        return `
STRICT WORD COUNT:
- 100–140 words ONLY.

STRUCTURE:
- EXACTLY 3–4 paragraphs.
- 6–10 sentences total.

ENFORCEMENT:
- If fewer than 3 paragraphs, KEEP WRITING.
- If fewer than 6 sentences, KEEP WRITING.
- If under 100 words, KEEP WRITING.
- If over 140 words, REWRITE until correct.
        `;
      }

      if (len === "long") {
        return `
STRICT WORD COUNT:
- 160–200 words ONLY.

STRICT PARAGRAPH COUNT:
- EXACTLY 6 paragraphs.

STRICT PARAGRAPH RULES:
- Each paragraph MUST be 25–35 words.
- Each paragraph MUST contain 2–3 sentences.

STRUCTURE:
- P1: Hook
- P2: Setup
- P3: Escalation 1
- P4: Escalation 2
- P5: Main moment
- P6: Reaction / closing

ENFORCEMENT (MANDATORY):
- If ANY paragraph is under 25 words, EXPAND IT.
- If ANY paragraph is over 35 words, REWRITE IT.
- If ANY paragraph has fewer than 2 sentences, ADD MORE.
- If ANY paragraph has more than 3 sentences, REWRITE IT.
- If total words < 160, KEEP WRITING.
- If total words > 200, REWRITE until correct.
- DO NOT STOP until ALL rules are satisfied.
        `;
      }

      return "Write a 120–150 word TikTok story.";
    }

    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone.";
      if (t === "hype") return "Use a hype, dramatic, high‑energy tone.";
      if (t === "soft") return "Use a soft, emotional, reflective tone.";
      return "Use a cinematic, descriptive story tone.";
    }

    function modeRules(m) {
      if (m === "hook") {
        return `
ONLY write the hook.
- 1–2 sentences.
- No story.
- No paragraphs.
        `;
      }

      if (m === "cta") {
        return `
ONLY write the call‑to‑action.
- 1–2 sentences.
- No story.
- No paragraphs.
        `;
      }

      return `
Write a full TikTok story script with CLEAR paragraph breaks.
      `;
    }

    const systemPrompt = `
You are a TikTok story script generator. You MUST follow every rule below with zero exceptions.

GLOBAL RULES (MANDATORY):
- NEVER ignore length rules.
- NEVER stop early.
- NEVER end mid‑sentence.
- ALWAYS finish the full narrative.
- ALWAYS expand simple ideas with sensory detail.
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
- If the story is not long enough, KEEP WRITING.
- If ANY rule is not satisfied, KEEP WRITING.
- If ANY paragraph is incomplete, KEEP WRITING.
- If ANY sentence is incomplete, KEEP WRITING.
- If ANY structure rule is broken, KEEP WRITING.
- DO NOT stop until ALL rules are satisfied.

OUTPUT FORMAT:
- Plain text only.
- Paragraphs separated by a SINGLE newline.
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

    let story = aiResponse.response || "";

    // Remove the hidden marker before returning
    story = story.replace(/\[END OF STORY\]/g, "").trim();

    return new Response(JSON.stringify({ story }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
