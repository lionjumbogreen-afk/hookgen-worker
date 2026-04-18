export default {
  async fetch(request, env) {
    // Handle CORS preflight
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

    const { topic } = await request.json();

    // Premium TikTok-style prompt
    const systemPrompt = `
You write TikTok-style cinematic storytime scripts.
Your writing feels human, emotional, visual, and fast-paced.
You avoid robotic or generic AI phrasing.
You write like a creator talking directly to the viewer.
You use tension, sensory detail, and natural pacing.
You avoid advice, motivation, or commentary.
You ONLY output the story.

Format:
### Story:
[story here]
    `.trim();

    const aiResponse = await env.AI.run(
      "@cf/meta/llama-3-8b-instruct",
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: topic }
        ]
      }
    );

    const story =
      aiResponse.response ||
      aiResponse.result ||
      JSON.stringify(aiResponse);

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
