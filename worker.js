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
    const { topic, tone, mode, shortPro, length } = body;

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
       3. MODE RULES (FIXED)
    ============================================================ */
    function modeRules(m, isLengthMode) {
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

      if (isLengthMode) {
        return `
Write a TikTok story in LINE FORMAT.
Do NOT use paragraphs.
Do NOT summarize.
Do NOT output a hook.
        `;
      }

      return `
Write a full TikTok story script.
Use natural paragraph breaks.
Do NOT stop early.
Do NOT summarize.
Do NOT output a hook.
      `;
    }

    /* ============================================================
       4. PRO VS FREE RULES
    ============================================================ */
    let planRules = "";

    if (isPro) {
      if (shortPro) {
        planRules = `
PRO USER RULES (SHORT MODE):
- EXACTLY 5 paragraphs.
- 200–300 words.
- Cinematic pacing.
- No early stopping.
        `;
      } else {
        planRules = `
PRO USER RULES:
- EXACTLY 10 paragraphs.
- 400–550 words.
- Rich sensory detail.
- Cinematic pacing.
- No early stopping.
        `;
      }
    } else {
      planRules = `
FREE USER RULES:
- EXACTLY 4 paragraphs (ONLY when length mode is NOT used).
- 150–200 words.
- Tight pacing.
      `;
    }

    /* ============================================================
       5. FINAL SYSTEM PROMPT
    ============================================================ */
    const systemPrompt = `
${planRules}

You are HookGen, an AI that writes viral TikTok story scripts.

TOPIC: ${topic}

STARTING RULE:
- If the user input is written like a hook, the story MUST begin with the exact text the user typed.
- If the user input is a topic, DO NOT start with it. Create a strong hook inspired by it.
- Never rewrite a hook. Never ignore a topic.

TONE:
${toneRules(tone)}

MODE:
${mode === "story"
    ? modeRules(mode, (!isPro && (length === "short" || length === "medium" || length === "long")))
    : modeRules(mode, false)
}


LENGTH RULES:
${(!isPro && length === "short") ? `
SHORT MODE:
- 4 to 6 lines total.
- 1 short sentence per line.
- Fast pacing.
- Immediate hook.
- No long paragraphs.
- End with a cliffhanger.
` : (!isPro && length === "medium") ? `
MEDIUM MODE:
- 8 to 12 lines total.
- Slightly more detail.
- One twist.
- No paragraphs longer than 2 sentences.
` : (!isPro && length === "long") ? `
LONG MODE:
- 15 to 40 lines.
- Full story structure.
- Atmosphere + buildup.
- Multiple beats.
- One major twist.
` : `
(No length mode active — paragraph rules apply.)
`}

${(!isPro && (length === "short" || length === "medium" || length === "long")) ? `
MANDATORY RULES:
- Output ONLY the story text.
- NO emojis.
- NO hashtags.
- NO markdown.
- NO filler.
- NO disclaimers.
- NO titles.
- NO section headers.
- Use natural LINE BREAKS.
- Follow the LENGTH RULES exactly.
` : `
MANDATORY RULES:
- Output ONLY the story text.
- NO emojis.
- NO hashtags.
- NO markdown.
- NO filler.
- NO disclaimers.
- NO titles.
- NO section headers.
- Use natural paragraph spacing.
- Follow the paragraph count EXACTLY.
- Follow the word count EXACTLY.
- If the model tries to end early, CONTINUE writing until the target range is met.
`}
    `.trim();

    /* ============================================================
       6. CALL THE MODEL
    ============================================================ */
    const model = "@cf/meta/llama-3-8b-instruct";

    const aiResponse = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: topic }
      ],
      max_tokens: 2000
    });

    const story = aiResponse.response || "";

    /* ============================================================
       7. PARAGRAPH ENFORCEMENT
    ============================================================ */
    function enforceParagraphCount(text, min, max) {
      let paragraphs = text
        .split(/\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

      if (paragraphs.length > max) {
        paragraphs = paragraphs.slice(0, max);
      }

      while (paragraphs.length < min) {
        const last = paragraphs.pop() || "";
        const secondLast = paragraphs.pop() || "";
        const merged = (secondLast + " " + last).trim();
        paragraphs.push(merged);
      }

      return paragraphs.join("\n\n");
    }

    /* ============================================================
   8. APPLY RULES
============================================================ */
let finalStory;

if (mode === "hook" || mode === "cta") {
  // For hook/CTA, just return what the model gave
  finalStory = story;
} else if (!isPro && (length === "short" || length === "medium" || length === "long")) {
  // Free + length mode → line-format story, no paragraph enforcement
  finalStory = story;
} else {
  // Paragraph enforcement for story mode
  if (isPro) {
    finalStory = shortPro
      ? enforceParagraphCount(story, 5, 5)
      : enforceParagraphCount(story, 10, 10);
  } else {
    finalStory = enforceParagraphCount(story, 4, 4);
  }
}



    /* ============================================================
       9. RETURN
    ============================================================ */
    return new Response(JSON.stringify({ story: finalStory, isPro }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
