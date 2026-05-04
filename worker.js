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
       HOOK DETECTION (for story mode)
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
- Each line must be a full sentence between 12 and 20 words.
- No micro-sentences or fragments.
- No dramatic one-word beats.
- Every line must read like a natural TikTok narrator sentence.
- FORCE a line break after every sentence.
- No paragraphs.
    `;
  } else if (format === "cinematic") {
    generationRules = `
PRO GEN — CINEMATIC MODE:
- EXACTLY 4 paragraphs.
- Each paragraph must contain full sentences between 12 and 20 words.
- No micro-sentences or fragments.
- No dramatic one-word beats.
- Cinematic pacing with rich sensory detail.
- Every sentence must read like a natural TikTok narrator line.
    `;
  } else {
    generationRules = `
PRO GEN — DEFAULT:
- Write 12–20 lines.
- Each line must be a full sentence between 12 and 20 words.
- No micro-sentences or fragments.
- No dramatic one-word beats.
- Every line must read like a natural TikTok narrator sentence.
    `;
  }
} else {
  generationRules = `
FREE MODE:
- "short": 5 full sentences.
- "medium": 7 full sentences.
- "long": 10 full sentences split into 2 paragraphs.
- Every sentence must be between 12 and 20 words.
- No micro-sentences or fragments.
- No dramatic one-word beats.
- Every sentence must read like a natural TikTok narrator line.
  `;
}

    /* ============================================================
       5. SYSTEM PROMPT
    ============================================================ */
    const systemPrompt = `
You are HookGen, an AI that writes viral TikTok story scripts.

TOPIC: ${topic}

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
- NEVER repeat the same sentence.
- NEVER loop.
- NEVER write introductions like "Here's a script", "Here's your TikTok story", or anything similar.
- Start immediately with the story or the hook.
- ALWAYS follow the exact structure defined in GENERATION RULES.
- NEVER explain what you are doing.
- NEVER apologize.
- NEVER break character as a TikTok story narrator.
- Each sentence must be a full sentence of at least 12 words.
- Do NOT write one-word or two-word sentences.
- Do NOT break a single idea into multiple micro-sentences.
- Each sentence must be between 12 and 20 words.
- Do NOT write sentence fragments.
- Do NOT split a single idea into multiple short sentences.
- Every sentence must read like a natural spoken TikTok narrator line.
- Do NOT write dramatic one-word or two-word sentences such as "Five." or "Years." or "Silence."
- Every sentence must contain a complete idea and must NOT be split into multiple short beats.
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
       7. CLEAN + SPLIT INTO SENTENCES
    ============================================================ */

    story = story
      .replace(/\r/g, "")
      .replace(/\s+/g, " ")
      .replace(/([.!?])\s+/g, "$1\n")
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    /* ============================================================
       8. REMOVE DUPLICATES
    ============================================================ */
    const seen = new Set();
    story = story.filter(line => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });

    /* ============================================================
       9. FORCE STORY TO START WITH USER HOOK
    ============================================================ */
    if (mode !== "hook" && looksLikeHook(topic)) {
      story.unshift(topic);
    }

    /* ============================================================
       10. FORMAT HELPERS
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
   11. FINAL OUTPUT (FIXED)
============================================================ */

let finalStory;

// HOOK MODE
if (mode === "hook") {
  finalStory = story.slice(0, 2).join(" ");

// CINEMATIC ALWAYS WINS (free or pro)
} else if (format === "cinematic") {
  // Pro Gen cinematic = 4 paragraphs
  // Free Mode cinematic = also 4 paragraphs
  finalStory = enforceParagraphs(story, 4);

// PRO GEN
} else if (isPro && proGen) {

  // LINE MODE (12–20 full sentences, each on its own line)
  if (format === "line") {
    finalStory = enforceLines(story, 20);

  // PRO GEN SHORT (5 full sentences)
  } else if (format === "short") {
    finalStory = takeSentences(story, 5);

  // PRO GEN MEDIUM (7 full sentences)
  } else if (format === "medium") {
    finalStory = takeSentences(story, 7);

  // PRO GEN LONG (10 full sentences, 2 paragraphs)
  } else if (format === "long") {
    finalStory = twoParagraphs(story, 10);

  // DEFAULT PRO GEN (12–20 lines)
  } else {
    finalStory = enforceLines(story, 20);
  }

// FREE MODE
} else {

  if (format === "short") {
    finalStory = takeSentences(story, 5);

  } else if (format === "medium") {
    finalStory = takeSentences(story, 7);

  } else if (format === "long") {
    finalStory = twoParagraphs(story, 10);

  } else {
    // fallback for free mode
    finalStory = takeSentences(story, 7);
  }
}

    /* ============================================================
       12. RETURN
    ============================================================ */
    return new Response(JSON.stringify({ story: finalStory, isPro }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
