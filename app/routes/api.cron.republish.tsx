import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { buildPublishedConfigSnapshot } from "../services/published-config.server";
import {
  getShopIdentity,
  publishConfigMetafield,
} from "../services/shopify-config.server";

// Scheduled re-publish (triggered by Vercel Cron — see vercel.json).
//
// Re-bakes each cutoff's current shop-local active state into the published
// metafield for every installed shop, so time-of-day rules (e.g. "hide same-day
// after 3:30 PM") flip automatically on EVERY checkout path — cart, "Buy it
// now", Shop Pay — without depending on a cart attribute that express checkouts
// skip. Idempotent: it just rewrites the current config with a fresh activeNow.
//
// Safety:
//  - CRON_SECRET (optional): when set, the request must carry
//    `Authorization: Bearer <CRON_SECRET>` (Vercel adds this header
//    automatically when the env var is configured).
//  - CRON_PUBLISH_SHOPS (optional, comma-separated): when set, only those shops
//    are published. Use this to keep an inert install (e.g. Highland) untouched.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const built = await buildPublishedConfigSnapshot();
  if (!built) {
    return Response.json({ ok: false, reason: "no-config" });
  }
  if (built.isTooLarge) {
    return Response.json({
      ok: false,
      reason: "too-large",
      bytes: built.payloadSizeBytes,
    });
  }

  const allow = (process.env.CRON_PUBLISH_SHOPS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const sessions = await prisma.session.findMany({ select: { shop: true } });
  const shops = Array.from(
    new Set(sessions.map((s) => s.shop).filter(Boolean)),
  ).filter((shop) => allow.length === 0 || allow.includes(shop.toLowerCase()));

  const results: Array<{ shop: string; ok: boolean; error?: string }> = [];
  for (const shop of shops) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      const identity = await getShopIdentity(admin);
      await publishConfigMetafield({
        admin,
        ownerId: identity.id,
        payloadJson: built.payloadJson,
      });
      results.push({ shop, ok: true });
    } catch (error) {
      results.push({
        shop,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Response.json({ ok: true, bytes: built.payloadSizeBytes, shops: results });
};
