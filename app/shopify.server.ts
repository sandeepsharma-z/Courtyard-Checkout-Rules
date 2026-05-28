import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { sessionStorage as runtimeSessionStorage } from "./services/session-storage.server";

const APP_URL =
  process.env.SHOPIFY_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "https://courtyard-checkout-rules.vercel.app";

const REQUIRED_SCOPES = [
  "read_products",
  "read_metaobjects",
  "write_metaobjects",
  "write_delivery_customizations",
  "read_validations",
  "write_validations",
];

const INVALID_SCOPES = new Set(["read_metafields", "write_metafields"]);

const configuredScopes =
  process.env.SCOPES?.split(",")
    .map((scope) => scope.trim())
    .filter((scope) => !INVALID_SCOPES.has(scope))
    .filter(Boolean) ?? [];

const scopes = Array.from(new Set([...configuredScopes, ...REQUIRED_SCOPES]));

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes,
  appUrl: APP_URL,
  authPathPrefix: "/auth",
  sessionStorage: runtimeSessionStorage,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
