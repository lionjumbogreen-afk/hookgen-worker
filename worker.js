export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const body = await request.json();
    const { topic, tone, mode, proGen, format } = body;

    /* ============================================================
       1. SECURE PRO CHECK
    ============================================================ */
    const authHeader = request.headers.get("Authorization") || "";
    const licenseKey = authHeader.replace("Bearer ", "").trim();

    let isPro = false;

    if (licenseKey) {
      try {
        const lsRes = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.LS_API_KEY}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            license_key: licenseKey,
            store_id: env.LS_STORE_ID ? Number(env.LS_STORE_ID) : undefined
          })
        });

        const lsData = await lsRes.json();
        if (lsData.valid && lsData.license && lsData.license.status === "active") {
          isPro = true;
        }
      } catch (err) {
        isPro = false;
      }
    }

    /* ============================================================
       2. TONE RULES
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
       3. MODE RULES
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

      return `
Write a full TikTok story script.
Do NOT stop early.
Do NOT summarize.
Do NOT output a hook unless the user typed one.
      `;
    }

    /* ============================================================
       4. PRO GEN RULES
    ============================================================ */

    let generationRules = "";

    if (isPro && proGen) {
      if (format === "line") {
        generationRules = `
PRO GEN — LINE MODE:
- Write 12–20 lines.
- 1 short sentence per line.
- High‑impact pacing.
- No paragraphs.
- No emojis.
- No hashtags.
- No markdown.
        `;
      } else if (format === "cinematic") {
        generationRules = `
PRO GEN — CINEMATIC MODE:
- EXACTLY 4 paragraphs.
- Cinematic pacing.
- Rich sensory detail.
- No emojis.
- No hashtags.
- No markdown.
        `;
      }
    } else {
      // FREE MODE
      generationRules = `
FREE MODE:
- 6–10 lines.
- 1 short sentence per line.
- No paragraphs.
- No emojis.
- No hashtags.
- No markdown.
      `;
    }

    /* ============================================================
       5. SYSTEM PROMPT
    ============================================================ */
    const systemPrompt = `
You are HookGen, an AI that writes viral TikTok story scripts.

TOPIC: ${topic}

STARTING RULE:
- If the user input is written like a hook, the story MUST begin with the exact text the user typed.
- If the user input is a topic, DO NOT start with it. Create a strong hook inspired by it.

TONE:
${toneRules(tone)}

MODE:
${modeRules(mode)}

GENERATION RULES:
${generationRules}

MANDATORY OUTPUT RULES:
- Output ONLY the story text.
- NO emojis.
- NO hashtags.
- NO markdown.
- NO filler.
- NO disclaimers.
- NO titles.
- NO section headers.
- Follow the format EXACTLY.
    `.trim();

    /* ============================================================
       6. CALL MODEL
    ============================================================ */
    const model = "@cf/meta/llama-3-8b-instruct";

    const aiResponse = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: topic }
      ],
      max_tokens: 2000
    });

    let story = aiResponse.response || "";

    /* ============================================================
       7. FORMAT ENFORCEMENT
    ============================================================ */

    function enforceLines(text, min, max) {
      let lines = text
        .split(/\n+/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (lines.length > max) lines = lines.slice(0, max);

      while (lines.length < min) {
        lines.push(lines[lines.length - 1] || "");
      }

      return lines.join("\n");
    }

    function enforceParagraphs(text, count) {
      let paragraphs = text
        .split(/\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

      if (paragraphs.length > count) {
        paragraphs = paragraphs.slice(0, count);
      }

      while (paragraphs.length < count) {
        paragraphs.push(paragraphs[paragraphs.length - 1] || "");
      }

      return paragraphs.join("\n\n");
    }

    let finalStory = story;

    if (mode === "hook" || mode === "cta") {
      // leave raw
    } else if (isPro && proGen) {
      if (format === "line") {
        finalStory = enforceLines(story, 12, 20);
      } else if (format === "cinematic") {
        finalStory = enforceParagraphs(story, 4);
      }
    } else {
      // FREE MODE
      finalStory = enforceLines(story, 6, 10);
    }

    /* ============================================================
       8. RETURN
    ============================================================ */
    return new Response(JSON.stringify({ story: finalStory, isPro }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
