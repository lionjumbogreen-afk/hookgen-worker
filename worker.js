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
    const { topic, tone, mode, plan } = body;

    /* ============================================================
       TONE RULES
    ============================================================ */
    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone.";
      if (t === "hype") return "Use a hype, dramatic, high‑energy tone.";
      if (t === "soft") return "Use a soft, emotional, reflective tone.";
      if (t === "tiktok_narrator")
        return "Write in the pacing and cadence of TikTok's narrator voice: short beats, clear pauses, clean emphasis.";
      return "Use a cinematic, descriptive story tone.";
    }

    /* ============================================================
       MODE RULES
    ============================================================ */
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

      // STORY MODE
      return `
Write a full TikTok story script.
Use natural paragraph breaks.
Do NOT stop early.
Do NOT summarize.
Do NOT output a hook.
      `;
    }

    /* ============================================================
       PRO VS FREE RULES
    ============================================================ */
    let planRules = "";

    if (plan === "pro") {
      planRules = `
PRO USER RULES:
- EXACTLY 6 paragraphs.
- 260–320 words.
- Rich sensory detail.
- Cinematic pacing.
- No early stopping.
      `;
    } else {
      planRules = `
FREE USER RULES:
- EXACTLY 4 paragraphs.
- 180–220 words.
- Tight pacing.
      `;
    }

    /* ============================================================
       FINAL SYSTEM PROMPT
    ============================================================ */
    const systemPrompt = `
${planRules}

You are HookGen, an AI that writes viral TikTok story scripts.

TOPIC: ${topic}

TONE:
${toneRules(tone)}

MODE:
${modeRules(mode)}

MANDATORY RULES:
- Output ONLY the story text.
- NO emojis.
- NO hashtags.
- NO markdown.
- NO filler like "Here is your story".
- NO disclaimers.
- NO titles.
- NO section headers.
- Use natural paragraph spacing.
- Follow the paragraph count EXACTLY.
- Follow the word count EXACTLY.
- If the model tries to end early, CONTINUE writing until the target range is met.
    `.trim();

    /* ============================================================
       CALL THE MODEL
    ============================================================ */
    const model = "@cf/meta/llama-3-8b-instruct";

    const aiResponse = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: topic }
      ],
      max_tokens: 1200
    });

    const story = aiResponse.response || "";

    return new Response(JSON.stringify({ story }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};

