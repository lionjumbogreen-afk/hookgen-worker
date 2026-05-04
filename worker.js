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
       HOOK DETECTION
    ============================================================ */
    function looksLikeHook(text) {
      return (
        text.length < 180 &&
        (
          /you|your|i|my|mom|dad|call|keeps|secret|mistake|truth|nobody|no one|here|this|that/i.test(text) ||
          /^[^.!?]{5,160}$/.test(text)
        )
      );
    }

    /* ============================================================
       PRO LICENSE CHECK
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
       TONE RULES
    ============================================================ */
    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone.";
      if (t === "hype") return "Use a hype, dramatic, high‑energy tone.";
      if (t === "soft") return "Use a soft, emotional, reflective tone.";
      if (t === "tiktok_narrator")
        return "Write in the pacing and cadence of TikTok's narrator voice: clean beats, steady rhythm, natural spoken flow.";
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
No introductions.
Start immediately with the hook.
        `;
      }

      return `
Write a full TikTok story.
Do NOT introduce the story.
Do NOT say "here's your script" or anything similar.
Start immediately with the first sentence of the story.
Do NOT summarize.
Do NOT explain.
      `;
    }

    /* ============================================================
       GENERATION RULES (FREE + PRO)
    ============================================================ */

    let generationRules = "";

    if (isPro && proGen) {
      if (format === "line") {
        generationRules = `
PRO GEN — LINE MODE:
- Write 12–20 lines.
- Each line must be a full sentence between 12 and 17 words.
- No micro-sentences or fragments.
- No dramatic one-word beats.
- FORCE a line break after every sentence.
- No paragraphs.
        `;
      } else if (format === "cinematic") {
        generationRules = `
PRO GEN — CINEMATIC MODE:
- EXACTLY 4 paragraphs.
- Each paragraph must contain full sentences between 12 and 17 words.
- No micro-sentences or fragments.
- No dramatic one-word beats.
- Cinematic pacing with rich sensory detail.
        `;
      } else {
        generationRules = `
PRO GEN — DEFAULT:
- Write 12–20 lines.
- Each line must be a full sentence between 12 and 17 words.
- No micro-sentences or fragments.
- No dramatic one-word beats.
        `;
      }
    } else {
      generationRules = `
FREE MODE:
- "short": 5 full sentences.
- "medium": 7 full sentences.
- "long": 10 full sentences split into 2 paragraphs.
- Every sentence must be between 12 and 17 words.
- No micro-sentences or fragments.
- No dramatic one-word beats.
- Every sentence must read like a natural TikTok narrator line.
      `;
    }

    /* ============================================================
       SYSTEM PROMPT (FINAL VERSION)
    ============================================================ */
    const systemPrompt = `
You are an AI that writes TikTok-style narrator stories with strict structural and sentence rules.

MANDATORY OUTPUT RULES:
- Output ONLY the story text.
- NO emojis.
- NO hashtags.
- NO markdown.
- NEVER repeat the same sentence.
- NEVER loop.
- NEVER write introductions like "Here's a script", "Here's your TikTok story", or anything similar.
- Start immediately with the story or the hook.
- ALWAYS follow the exact structure defined in GENERATION RULES.
- NEVER explain what you are doing.
- NEVER apologize.
- NEVER break character as a TikTok story narrator.

### SENTENCE RULES (STRICT)
- Every sentence must be between 12 and 17 words.
- Each sentence must be a complete idea.
- End every sentence with a period.
- Use NO MORE than one comma per sentence.
- Do NOT chain multiple ideas together with commas.
- Do NOT write run-on sentences.
- Do NOT write sentence fragments.
- Do NOT split a single idea into multiple short sentences.
- Do NOT write one-word or two-word sentences.
- Do NOT write dramatic beats like "Five." or "Years." or "Silence."
- Every sentence must read like a natural spoken TikTok narrator line.

### TONE RULES
${toneRules(tone)}

### MODE RULES
${modeRules(mode)}

### GENERATION RULES
${generationRules}
`;

    /* ============================================================
       RUN MODEL
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
       CLEAN + SPLIT SENTENCES
    ============================================================ */
    story = story
      .replace(/\r/g, "")
      .replace(/\s+/g, " ")
      .replace(/([.!?])\s+(?=[A-Z0-9])/g, "$1\n")
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    /* ============================================================
       REMOVE DUPLICATES
    ============================================================ */
    const seen = new Set();
    story = story.filter(line => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });

    /* ============================================================
       FORCE HOOK FIRST
    ============================================================ */
    if (mode !== "hook" && looksLikeHook(topic)) {
      story.unshift(topic);
    }

    /* ============================================================
       FORMAT HELPERS
    ============================================================ */
    function takeSentences(lines, count) {
      return lines.slice(0, count).join(" ");
    }

    function twoParagraphs(lines, total) {
      const trimmed = lines.slice(0, total);
      const half = Math.ceil(trimmed.length / 2);
      return trimmed.slice(0, half).join(" ") + "\n\n" + trimmed.slice(half).join(" ");
    }

    function enforceLines(lines, max) {
      return lines.slice(0, max).join("\n");
    }

    function enforceParagraphs(lines, count) {
      let out = [];
      let chunk = Math.ceil(lines.length / count);
      for (let i = 0; i < count; i++) {
        const part = lines.slice(i * chunk, (i + 1) * chunk);
        if (part.length) out.push(part.join(" "));
      }
      return out.join("\n\n");
    }

    /* ============================================================
       FINAL OUTPUT
    ============================================================ */
    let finalStory;

    if (mode === "hook") {
      finalStory = story.slice(0, 2).join(" ");
    } else if (format === "cinematic") {
      finalStory = enforceParagraphs(story, 4);
    } else if (isPro && proGen) {
      if (format === "line") {
        finalStory = enforceLines(story, 20);
      } else if (format === "short") {
        finalStory = takeSentences(story, 5);
      } else if (format === "medium") {
        finalStory = takeSentences(story, 7);
      } else if (format === "long") {
        finalStory = twoParagraphs(story, 10);
      } else {
        finalStory = enforceLines(story, 20);
      }
    } else {
      if (format === "short") {
        finalStory = takeSentences(story, 5);
      } else if (format === "medium") {
        finalStory = takeSentences(story, 7);
      } else if (format === "long") {
        finalStory = twoParagraphs(story, 10);
      } else {
        finalStory = takeSentences(story, 7);
      }
    }

    /* ============================================================
       RETURN
    ============================================================ */
    return new Response(JSON.stringify({ story: finalStory, isPro }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
