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

    // ⭐ HOOKGEN+ ADDITION — added plan
    const { topic, tone, mode, plan } = body;

    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone.";
      if (t === "hype") return "Use a hype, dramatic, high-energy tone.";
      if (t === "soft") return "Use a soft, emotional, reflective tone.";
      if (t === "tiktok_narrator")
        return "Write in the pacing and cadence of TikTok's narrator voice: short beats, clear pauses, clean emphasis.";
      return "Use a cinematic, descriptive story tone.";
    }

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
ONLY write the call-to-action.
1–2 sentences.
No story.
        `;
      }

      return `
Write a full TikTok story script.

MANDATORY LENGTH RULES:
- Target 180–220 words.
- Use 4–6 paragraphs.
- Maintain smooth pacing.
- Expand scenes with sensory detail and emotional depth.
- If the story is too short, continue writing until the target range is reached.

STYLE RULES:
- Cinematic pacing.
- No emojis. No hashtags. No markdown.
- No filler like "Here is your story."

ENDING RULES:
- The final paragraph MUST fully resolve the story.
- NO cliffhangers.
- NO incomplete final sentences.
      `;
    }

    // ⭐ HOOKGEN+ ADDITION — Pro vs Free rules
    let proRules = "";

    if (plan === "pro") {
      proRules = `
PRO USER RULES:
- Target 260–320 words.
- Use 6–8 paragraphs.
- Add richer sensory detail.
- Add deeper emotional beats.
- Maintain cinematic pacing.
- Absolutely no early stopping.
      `;
    } else {
      proRules = `
FREE USER RULES:
- Target 180–220 words.
- Use 4–6 paragraphs.
      `;
    }

    const systemPrompt = `
${proRules}

You are a TikTok story script generator.

Your job is to ALWAYS produce a story between the required word range.
If the model tries to end early, CONTINUE writing until the target range is met.

STRUCTURE:
- Natural pacing.
- Smooth emotional flow.
- No emojis. No hashtags. No markdown.

TONE:
${toneRules(tone)}

MODE:
${modeRules(mode)}
    `.trim();

    const model = "@cf/meta/llama-3-8b-instruct";

    const aiResponse = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: topic }
      ],
      max_tokens: 900
    });

    const story = aiResponse.response || "";

    return new Response(JSON.stringify({ story }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};

