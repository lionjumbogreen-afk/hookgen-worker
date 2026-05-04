export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* ============================================================
       WEBHOOK HANDLER (FINAL PATCHED VERSION)
    ============================================================ */
    if (url.pathname === "/webhook") {
      const cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-Signature",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      };

      if (request.method === "OPTIONS") {
        return new Response(null, { headers: cors });
      }

      const bodyText = await request.text();
      const signature = request.headers.get("X-Signature") || "";

      // Convert HEX → Uint8Array (Lemon Squeezy uses HEX signatures)
      function hexToUint8(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return bytes;
      }

      const encoder = new TextEncoder();
      const keyData = encoder.encode(env.LEMON_SECRET || "");
      const signatureBytes = hexToUint8(signature);

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const isValid = await crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        signatureBytes,
        encoder.encode(bodyText)
      ).catch(() => false);

      if (!isValid) {
        return new Response("Invalid signature", { status: 401, headers: cors });
      }

      // Parse webhook JSON
      let data;
      try {
        data = JSON.parse(bodyText);
      } catch {
        return new Response("Bad JSON", { status: 400, headers: cors });
      }

      // Extract event name
      const event = data?.meta?.event_name || "";

      // Only process license events
      if (event !== "license_key_created" && event !== "license_key_updated") {
        return new Response("Ignored", { status: 200, headers: cors });
      }

      // Extract license info
      const licenseKey = data?.data?.attributes?.key || "";
      const status = data?.data?.attributes?.status || "";

      if (licenseKey) {
        await env.LICENSES.put(licenseKey, status);
      }

      return new Response("OK", { status: 200, headers: cors });
    }

    /* ============================================================
       STORY GENERATOR (YOUR ORIGINAL CODE)
    ============================================================ */

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

    function looksLikeHook(text) {
      return (
        text.length < 180 &&
        (
          /you|your|i|my|mom|dad|call|keeps|secret|mistake|truth|nobody|no one|here|this|that/i.test(text) ||
          /^[^.!?]{5,160}$/.test(text)
        )
      );
    }

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

    function toneRules(t) {
      if (t === "direct") return "Use a direct, punchy tone.";
      if (t === "hype") return "Use a hype, dramatic, high‑energy tone.";
      if (t === "soft") return "Use a soft, emotional, reflective tone.";
      if (t === "tiktok_narrator")
        return "Write in the pacing and cadence of TikTok's narrator voice: clean beats, steady rhythm, natural spoken flow.";
      return "Use a cinematic, descriptive story tone.";
    }

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

    let generationRules = "";

    if (isPro && proGen) {
      if (format === "line") {
        generationRules = `
PRO GEN — LINE MODE:
- Write 12–20 lines.
- Each line must be a full sentence between 12 and 17 words.
- FORCE a line break after every sentence.
        `;
      } else if (format === "cinematic") {
        generationRules = `
PRO GEN — CINEMATIC MODE:
- EXACTLY 4 paragraphs.
- Each paragraph must contain full sentences between 12 and 17 words.
        `;
      } else {
        generationRules = `
PRO GEN — DEFAULT:
- Write 12–20 lines.
- Each line must be a full sentence between 12 and 17 words.
        `;
      }
    } else {
      generationRules = `
FREE MODE:
- "short": 5 full sentences.
- "medium": 7 full sentences.
- "long": 10 full sentences split into 2 paragraphs.
      `;
    }

    const systemPrompt = `
You are an AI that writes TikTok-style narrator stories with strict structural and sentence rules.

### TONE RULES
${toneRules(tone)}

### MODE RULES
${modeRules(mode)}

### GENERATION RULES
${generationRules}
`;

    const model = "@cf/meta/llama-3-8b-instruct";

    const aiResponse = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: topic }
      ],
      max_tokens: 2000
    });

    let story = aiResponse.response || "";

    story = story
      .replace(/\r/g, "")
      .replace(/\s+/g, " ")
      .replace(/([.!?])\s+(?=[A-Z0-9])/g, "$1\n")
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const seen = new Set();
    story = story.filter(line => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });

    if (mode !== "hook" && looksLikeHook(topic)) {
      story.unshift(topic);
    }

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

    return new Response(JSON.stringify({ story: finalStory, isPro }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
