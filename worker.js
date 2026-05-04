export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* ============================================================
       RAW BODY READER (fixes signature verification)
    ============================================================ */
    async function readRawBody(req) {
      const reader = req.body.getReader();
      const chunks = [];
      let done, value;

      while (true) {
        ({ done, value } = await reader.read());
        if (done) break;
        chunks.push(value);
      }

      return new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        .map((_, i) => chunks.reduce((sum, chunk) => {
          if (i < chunk.length) return chunk[i];
          i -= chunk.length;
          return sum;
        }, 0));
    }

    /* ============================================================
       WEBHOOK HANDLER
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

      // Read raw body (CRITICAL FIX)
      const rawBody = await readRawBody(request);
      const bodyText = new TextDecoder().decode(rawBody);

      const signature = request.headers.get("X-Signature") || "";
      const secret = env.LEMON_SECRET;

      // Convert hex signature → bytes
      function hexToUint8(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return bytes;
      }

      const signatureBytes = hexToUint8(signature);

      // Import secret key
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      // Verify signature
      const isValid = await crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        signatureBytes,
        rawBody
      ).catch(() => false);

      if (!isValid) {
        return new Response("Invalid signature", { status: 401, headers: cors });
      }

      // Parse JSON
      let data;
      try {
        data = JSON.parse(bodyText);
      } catch {
        return new Response("Bad JSON", { status: 400, headers: cors });
      }

      const event = data?.meta?.event_name || "";

      // Only process license events
      if (event !== "license_key_created" && event !== "license_key_updated") {
        return new Response("Ignored", { status: 200, headers: cors });
      }

      const licenseKey = data?.data?.attributes?.key || "";
      const status = data?.data?.attributes?.status || "inactive";

      if (licenseKey) {
        const record = {
          status,
          activations: []
        };
        await env.LICENSES.put(licenseKey, JSON.stringify(record));
      }

      return new Response("OK", { status: 200, headers: cors });
    }

    /* ============================================================
       LICENSE VALIDATION + 3 DEVICE ACTIVATION
    ============================================================ */

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

      // Check existing activations
      const activations = record.activations || [];

      // Already activated on this device
      if (activations.some(a => a.deviceId === deviceId)) {
        return new Response(JSON.stringify({
          ok: true,
          isPro: true,
          devicesUsed: activations.length,
          devicesAllowed: 3
        }), { headers: cors });
      }

      // Enforce 3 device limit
      if (activations.length >= 3) {
        return new Response(JSON.stringify({
          ok: false,
          error: "activation_limit",
          message: "This license is already activated on 3 devices."
        }), { headers: cors });
      }

      // Add new activation
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

    /* ============================================================
       YOUR STORY GENERATOR ROUTE (unchanged)
    ============================================================ */

    return new Response("Worker online");
  }
};
