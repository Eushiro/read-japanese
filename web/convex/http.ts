import { httpRouter } from "convex/server";

import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// ============================================
// STRIPE WEBHOOK ENDPOINT
// ============================================

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("No signature", { status: 400 });
    }

    const body = await request.text();

    try {
      // Process webhook via action (which has access to Node.js runtime)
      const result = await ctx.runAction(api.stripe.processWebhook, {
        body,
        signature,
      });

      if (!result.success) {
        console.error("Webhook processing failed:", result.error);
        return new Response(result.error || "Webhook processing failed", { status: 400 });
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("Webhook error:", err);
      return new Response("Internal error", { status: 500 });
    }
  }),
});

export default http;
