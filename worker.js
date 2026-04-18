export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405 });
    }

    const { topic } = await request.json();

    const systemPrompt = `
You are HookGen, an AI that turns any topic into a cinematic TikTok-style story.

When the user enters a topic, generate a story based ONLY on that topic.

Rules:
- Start with a strong hook (1–2 sentences)
- Write a flowing story body (6–10 sentences)
- End with a single closing line
- Match the tone of the topic (dark, emotional, dramatic, mystery, etc.)
- Do NOT talk to the user
- Do NOT add advice or motivation
- Do NOT add commentary
- ONLY output the story

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

    return new Response(
      JSON.stringify({ story: aiResponse.response }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
};
