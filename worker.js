export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Signature, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/generate") {
      try {
        const body = await request.json();

        const topic = body.topic || "";
        const mode = body.mode || "story";
        const format = body.format || "short";
        const proGen = body.proGen || false;

        // ⭐ PUBLIC MODE: Pro Gen unlocked
        const isPro = proGen ? true : false;

        const isHook =
          topic.trim().endsWith("...") ||
          topic.split(" ").length <= 12;

        let hook = "";
        let storyPrompt = "";

        // ============================
        // HOOK MODE (FIXED)
        // ============================
        if (mode === "hook") {
          storyPrompt = `
You are generating a dramatic TikTok-style hook.

RULES:
- 1–2 sentences only
- No hashtags
- No jokes unless topic is comedic
- No timestamps
- No "Your Hook:" prefix
- Must feel emotional, mysterious, or urgent
- Must sound like a viral TikTok story opener

FORMAT EXAMPLES:
“My mom can’t stop shaking… and the doctors won’t tell us why.”
“My mom’s hands wouldn’t stop shaking — and last night, I found out the reason.”
“My mom started shaking uncontrollably… and then things got worse.”

Now write a hook in this style based on the topic below.

Topic: ${topic}
          `;
        }

        // ============================
        // STORY MODE
        // ============================
        if (mode === "story") {
          hook = isHook ? topic : `Generate a viral TikTok hook for this topic: ${topic}`;

          // ⭐ FIX: handle "line" format
          const normalizedFormat =
            format === "line" ? "short" : format;

          // FREE LENGTHS
          let freeSentenceCount =
            normalizedFormat === "short" ? 7 :
            normalizedFormat === "medium" ? 12 :
            normalizedFormat === "long" ? 16 :
            7;

          // PRO LENGTHS
          let proSentenceCount =
            normalizedFormat === "short" ? 10 :
            normalizedFormat === "medium" ? 16 :
            normalizedFormat === "long" ? 22 :
            12;

          // ============================
          // ⭐ NEW MODES ADDED HERE
          // ============================

          // SUSPENSE
          if (mode === "suspense") {
            storyPrompt = `
Write a suspenseful TikTok-style story that builds tension quickly.
Use short, punchy sentences. Keep the pacing tight.
End with a cliffhanger that forces a part 2.
No hashtags. No emojis.

Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          // EMOTIONAL
          else if (mode === "emotional") {
            storyPrompt = `
Write an emotional, heart-wrenching TikTok story.
Use deep feelings, vulnerability, and raw honesty.
Make the viewer feel the heartbreak or confusion.
No hashtags. No emojis.

Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          // CONFESSION
          else if (mode === "confession") {
            storyPrompt = `
Write a TikTok confession story.
Start with a strong “I never told anyone this…” tone.
Reveal something shocking, embarrassing, or dramatic.
Keep it personal and first-person.

Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          // POV
          else if (mode === "pov") {
            storyPrompt = `
Write a TikTok POV story.
Start with "POV:" and make it immersive.
Describe the situation from the viewer’s perspective.
No hashtags. No emojis.

Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          // PLOT TWIST
          else if (mode === "plottwist") {
            storyPrompt = `
Write a TikTok story with a shocking plot twist at the end.
Build a normal situation, then flip everything in the final lines.
No hashtags. No emojis.

Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          // MYSTERY
          else if (mode === "mystery") {
            storyPrompt = `
Write a mysterious TikTok story.
Focus on strange events, unexplained behavior, or eerie details.
Keep the viewer guessing. No gore.
No hashtags. No emojis.

Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          // COMEDY
          else if (mode === "comedy") {
            storyPrompt = `
Write a funny TikTok story with Gen-Z humor.
Use chaotic energy, unexpected jokes, and relatable moments.
Keep it light and entertaining.

Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          // GLOW-UP
          else if (mode === "glowup") {
            storyPrompt = `
Write a TikTok glow-up transformation story.
Focus on personal growth, confidence, and leveling up.
Make it inspiring and uplifting.

Start with this hook EXACTLY: "${hook}"
Topic: ${topic}
            `;
          }

          // ============================
          // CINEMATIC MODE (PRO ONLY)
          // ============================
          else if (isPro && normalizedFormat === "cinematic") {
            storyPrompt = `
You are an expert cinematic storyteller.

Write a long, emotional, dramatic TikTok cinematic story.

STRICT RULES:
- Start with this hook EXACTLY: "${hook}"
- NO timestamps
- NO line-by-line format
- Write in FIRST PERSON
- EXACTLY 4 paragraphs
- EXACTLY 5 sentences per paragraph

Topic: ${topic}
            `;
          }

          // ============================
          // PRO GEN (line mode + short/medium/long)
          // ============================
          else if (isPro) {
            storyPrompt = `
You are an expert TikTok storyteller.

Write a first-person viral TikTok story.

STRICT RULES:
- Start with this hook EXACTLY: "${hook}"
- NO timestamps
- Write in FIRST PERSON
- EXACTLY ${proSentenceCount} sentences
- Add richer detail, deeper emotion, and vivid descriptions

Topic: ${topic}
            `;
          }

          // ============================
          // FREE MODE
          // ============================
          else {
            storyPrompt = `
You are an expert TikTok storyteller.

Write a first-person viral TikTok story.

STRICT RULES:
- Start with this hook EXACTLY: "${hook}"
- NO timestamps
- Write in FIRST PERSON
- EXACTLY ${freeSentenceCount} sentences
- Make it dramatic and smooth

Topic: ${topic}
            `;
          }
        }

        // ============================
        // CTA MODE
        // ============================
        if (mode === "cta") {
          storyPrompt = `
Write a short TikTok CTA based on this topic.

Rules:
- 1–2 lines
- No timestamps

Topic: ${topic}
          `;
        }

        // ============================
        // RUN AI
        // ============================
        const ai = env.AI;
        const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [{ role: "user", content: storyPrompt }]
        });

        return new Response(
          JSON.stringify({ story: result.response, isPro }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );

      } catch (err) {
        return new Response(
          JSON.stringify({ error: "generation_failed", details: err.toString() }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
};
