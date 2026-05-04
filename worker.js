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
    // FREE: format = "short" | "medium" | "long"
    // PRO:  format = "line" | "cinematic"

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

      return `
Write a full TikTok story script.
Do NOT stop early.
Do NOT summarize.
Do NOT output a hook unless the user typed one.
      `;
    }

    /* ============================================================
       4. PRO GEN / FREE RULES
    ============================================================ */

    let generationRules = "";

    if (isPro && proGen) {
      if (format === "line") {
        generationRules = `
PRO GEN — LINE MODE:
- Write 12–20 lines.
- 1 short sentence per line.
- FORCE a line break after every sentence.
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
      } else {
        generationRules = `
PRO GEN — DEFAULT:
- 12–20 lines.
- 1 short sentence per line.
- FORCE a line break after every sentence.
- No paragraphs.
- No emojis.
- No hashtags.
- No markdown.
        `;
      }
    } else {
      generationRules = `
FREE MODE:
- Use the selected length:
  - "short": about 5 sentences.
  - "medium": about 7 sentences.
  - "long": about 10 sentences total, split into 2 paragraphs.
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
- NEVER repeat the same sentence.
- NEVER repeat the same idea.
- NEVER loop.
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
       7. HARD CLEANING: SPLIT SENTENCES
    ============================================================ */

    story = story
      .replace(/\r/g, "")
      .replace(/\s+/g, " ")
      .replace(/([.!?])\s+/g, "$1\n") // force line breaks after sentence end
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    /* ============================================================
       8. REMOVE REPEATED SENTENCES
    ============================================================ */
    const seen = new Set();
    story = story.filter(line => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });

    /* ============================================================
       9. FORMAT HELPERS
    ============================================================ */

    function takeSentences(lines, count) {
      if (lines.length === 0) return "";
      return lines.slice(0, count).join(" ");
    }

    function twoParagraphsFromSentences(lines, totalSentences) {
      if (lines.length === 0) return "";
      const trimmed = lines.slice(0, totalSentences);
      const half = Math.ceil(trimmed.length / 2);
      const p1 = trimmed.slice(0, half).join(" ");
      const p2 = trimmed.slice(half).join(" ");
      return [p1, p2].filter(p => p.length > 0).join("\n\n");
    }

    function enforceLines(lines, max) {
      if (lines.length > max) lines = lines.slice(0, max);
      return lines.join("\n");
    }

    function enforceParagraphs(lines, count) {
      if (lines.length === 0) return "";
      let paragraphs = [];
      let chunkSize = Math.max(1, Math.ceil(lines.length / count));

      for (let i = 0; i < count; i++) {
        const chunk = lines.slice(i * chunkSize, (i + 1) * chunkSize);
        if (chunk.length === 0) continue;
        paragraphs.push(chunk.join(" "));
      }

      return paragraphs.join("\n\n");
    }

    /* ============================================================
       10. FINAL FORMAT DECISION
    ============================================================ */

    let finalStory;

    if (mode === "hook") {
      // hook = 1–2 sentences max
      const hookLines = story.slice(0, 2);
      finalStory = hookLines.join(" ");
    } else if (isPro && proGen) {
      if (format === "cinematic") {
        finalStory = enforceParagraphs(story, 4);
      } else {
        // line mode or fallback
        finalStory = enforceLines(story, 20);
      }
    } else {
      // FREE STORY MODE — use format as length selector
      const len = format || "medium";

      if (len === "short") {
        finalStory = takeSentences(story, 5);
      } else if (len === "medium") {
        finalStory = takeSentences(story, 7);
      } else {
        finalStory = twoParagraphsFromSentences(story, 10);
      }
    }

    /* ============================================================
       11. RETURN
    ============================================================ */
    return new Response(JSON.stringify({ story: finalStory, isPro }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
