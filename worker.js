export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ============================================================
    // HOOKGEN GENERATION ROUTES (story, hook-only, cta)
    // These requests get forwarded to your AI worker.
    // ============================================================
    if (
      url.pathname === "/generate" ||
      url.pathname === "/hook" ||
      url.pathname === "/cta"
    ) {
      // Forward to your AI worker
      return fetch("https://your-ai-worker-url" + url.pathname, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
    }

    // ============================================================
    // RAW BODY READER
    // ============================================================
    async function readRawBody(req) {
      const reader = req.body.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      let length = chunks.reduce((a, c) => a + c.length, 0);
      let merged = new Uint8Array(length);
      let offset = 0;
      for (let chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      return merged;
    }

    // ============================================================
    // WEBHOOK HANDLER
    // ============================================================
    if (url.pathname === "/webhook") {
      const cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-Signature",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      };

      if (request.method === "OPTIONS") {
        return new Response(null, { headers: cors });
      }

      const rawBody = await readRawBody(request);
      const bodyText = new TextDecoder().decode(rawBody);

      const signature = request.headers.get("X-Signature") || "";
      if (!signature) {
        return new Response("Missing signature", { status: 400, headers: cors });
      }

      function hexToUint8(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return bytes;
      }

      let signatureBytes;
      try {
        signatureBytes = hexToUint8(signature);
      } catch (e) {
        return new Response("Bad signature format", { status: 400, headers: cors });
      }

      const secret = env.LEMON_SECRET;

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const isValid = await crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        signatureBytes,
        rawBody
      ).catch(() => false);

      if (!isValid) {
        return new Response("Invalid signature", { status: 401, headers: cors });
      }

      let data;
      try {
        data = JSON.parse(bodyText);
      } catch {
        return new Response("Bad JSON", { status: 400, headers: cors });
      }

      const event = data?.meta?.event_name || "";

      if (event !== "license_key_created" && event !== "license_key_updated") {
        return new Response("Ignored", { status: 200, headers: cors });
      }

      const licenseKey = data?.data?.attributes?.key || "";
      const status = event === "license_key_created"
        ? "active"
        : data?.data?.attributes?.status;

      if (licenseKey) {
        const record = {
          status,
          activations: []
        };
        await env.LICENSES.put(licenseKey, JSON.stringify(record));
      }

      return new Response("OK", { status: 200, headers: cors });
    }

    // ============================================================
    // ACTIVATION ENDPOINT (3 DEVICES)
    // ============================================================
    if (url.pathname === "/activate") {
      const cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      };

      if (request.method === "OPTIONS") {
        return new Response(null, { headers: cors });
      }

      const body = await request.json();
      const { licenseKey, deviceId } = body;

      if (!licenseKey || !deviceId) {
        return new Response(JSON.stringify({
          ok: false,
          error: "missing_fields"
        }), { headers: cors });
      }

      const raw = await env.LICENSES.get(licenseKey);
      if (!raw) {
        return new Response(JSON.stringify({
          ok: false,
          error: "license_not_found"
        }), { headers: cors });
      }

      const record = JSON.parse(raw);

      if (record.status !== "active") {
        return new Response(JSON.stringify({
          ok: false,
          error: "inactive_license"
        }), { headers: cors });
      }

      const activations = record.activations || [];

      if (activations.some(a => a.deviceId === deviceId)) {
        return new Response(JSON.stringify({
          ok: true,
          isPro: true,
          devicesUsed: activations.length,
          devicesAllowed: 3
        }), { headers: cors });
      }

      if (activations.length >= 3) {
        return new Response(JSON.stringify({
          ok: false,
          error: "activation_limit",
          message: "This license is already activated on 3 devices."
        }), { headers: cors });
      }

      activations.push({
        deviceId,
        timestamp: Date.now()
      });

      record.activations = activations;

      await env.LICENSES.put(licenseKey, JSON.stringify(record));

      return new Response(JSON.stringify({
        ok: true,
        isPro: true,
        devicesUsed: activations.length,
        devicesAllowed: 3
      }), { headers: cors });
    }

    // ============================================================
    // DEFAULT FALLBACK
    // ============================================================
    return fetch(request);
  }
};
