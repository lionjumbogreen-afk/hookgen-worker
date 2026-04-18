xport default {
  async fetch(request, env) {
    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405 });
    }

    // Read request
    const { topic, tone, length, mode } = await request.json();

    // Length → word count mapping
    function getLengthInstruction(len) {
      if (len === "short") {
        return "Write a 15–20 second TikTok story (~45–65 words).";
      }
      if (len === "medium") {
        return "Write a 30–45 second TikTok story (~90–140 words).";
      }
      if (len === "long") {
        return "Write a 55–65 second cinematic TikTok story (~165–200 words).";
      }
      return "";
    }

    // Tone mapping
    function getToneInstruction(t) {
      if (t === "direct") return "Use a direct, punchy, confident tone.";
      if (t === "hype") return "Use a hype, high-energy, dramatic tone.";
      if (t === "story") return "Use a cinematic, emotional, story-driven tone.";
      if (t === "soft") return "Use a soft, calm, emotional tone.";
      return "";
    }

    // Mode mapping
    function getModeInstruction(m) {
      if (m === "hook") return "ONLY write the hook. 1–2 sentences max.";
      if (m === "cta") return "ONLY write the call-to-action. 1–2 sentences.";
      return "Write a full TikTok story script with hook, setup, tension, payoff, and a closing line.";
    }

    // Build final system prompt
    const systemPrompt = `
You write TikTok-style cinematic storytime scripts.
Your writing feels human, emotional, visual, and fast-paced.
You avoid robotic or generic AI phrasing.
You write like a creator talking directly to the viewer.
You use tension, sensory detail, and natural pacing.
You avoid advice, motivation, or commentary.
You ONLY output the story.

Follow these rules:
- No emojis.
- No hashtags.
- No disclaimers.
- No commentary.
- No extra formatting besides the story.

${getToneInstruction(tone)}
${getLengthInstruction(length)}
${getModeInstruction(mode)}

Format:
### Story:
[story here]
    `.trim();

    // AI call
    const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: topic }
      ]
    });

    const story =
      aiResponse.response ||
      aiResponse.result ||
      JSON.stringify(aiResponse);

    // Return JSON
    return new Response(
      JSON.stringify({ story }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        }
      }
    );
  }
};
