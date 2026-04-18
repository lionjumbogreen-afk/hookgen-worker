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

    const systemPrompt = `
You are HookGen, an AI that turns any topic into a cinematic TikTok-style story.

Rules:
- Start with a strong hook
- Write 6–10 flowing sentences
- End with a single closing line
- Match the tone of the topic
- ONLY output the story
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
