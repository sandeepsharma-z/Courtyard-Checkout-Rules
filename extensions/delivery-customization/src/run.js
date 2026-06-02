// @ts-check

const NO_CHANGES = { operations: [] };
const PUBLISHED_CONFIG_MAX_CHARS = 100000;
const SUPPORTED_SCHEMA_VERSION = 2;
const SUPPORTED_CONFIG_KIND = "courtyard_checkout_rules.pincode_config";

// Product tags whose presence in the cart the Function can actually read.
// MUST stay in sync with the hasTags(...) list in run.graphql. A rule that uses
// a tag outside this list keeps its legacy behavior, so existing rules never
// change.
const READABLE_TAGS = ["DNCR-cow-milk", "DNCR", "NT2", "Mum", "MT2", "Ind"];

// Tags that take OVER the cart: if any cart product carries one, only rules
// scoped to that tag apply and plain (no-tag) zone rules are skipped. Used for
// cow-milk, which must never show same-day even at a Delhi-NCR pincode where the
// plain Near/Average rules would otherwise offer it. All other readable tags are
// additive (they combine with the zone rules).
const EXCLUSIVE_TAGS = ["DNCR-cow-milk"];

/**
 * Applies published shipping hide / show (allowlist) / rename rules at checkout.
 * Lean single-pass implementation: keeps the function fast and its output small.
 *
 * @param {unknown} input
 * @returns {{ operations: Array<{ hide: { deliveryOptionHandle: string } } | { rename: { deliveryOptionHandle: string, title: string } }> }}
 */
export function run(input) {
  const config = parsePublishedConfig(input);
  if (!config) {
    return NO_CHANGES;
  }

  const operations = [];
  const deliveryGroups = Array.isArray(input?.cart?.deliveryGroups)
    ? input.cart.deliveryGroups
    : [];
  // Shop-local time ("HH:MM") written by the Courtyard time embed block.
  // Reads the current attribute key and the legacy underscore key, so it works
  // whether the storefront serves the new or the previously deployed embed.
  const cartTime =
    normalize(input?.cart?.timeAttr?.value) ||
    normalize(input?.cart?.timeAttrLegacy?.value);
  // Tags present on any product in the cart (only those listed in run.graphql
  // are observable). Used to apply tag-scoped rules, e.g. cow-milk.
  const cartTags = collectCartTags(input);

  for (const group of deliveryGroups) {
    const pincode = normalize(group?.deliveryAddress?.zip);
    const pincodeRecord = findPincodeRecord(config, pincode);
    const options = Array.isArray(group?.deliveryOptions)
      ? group.deliveryOptions
      : [];

    // Unserviceable / blocked pincode: hide every delivery option so the
    // checkout offers no shipping (mirrors the product-validation block, where
    // the location shows a "not available" error).
    if (pincodeBlocked(config, pincode, pincodeRecord, cartTime, cartTags)) {
      for (const option of options) {
        const handle = normalize(option?.handle);
        if (handle) operations.push({ hide: { deliveryOptionHandle: handle } });
      }
      continue;
    }

    const hideRules = Array.isArray(config.rules?.shippingHideRules)
      ? config.rules.shippingHideRules
      : [];
    // Build the allowlist (show) and blocklist (hide) matchers for this pincode.
    const showMatchers = [];
    const hideMatchers = [];
    let hasAllowlist = false;
    let ruleMatched = false;
    for (const rule of hideRules) {
      if (
        !ruleMatchesContext(
          rule,
          pincode,
          pincodeRecord,
          config,
          cartTime,
          cartTags,
        )
      )
        continue;
      ruleMatched = true;
      const methods = Array.isArray(rule.selectedShippingMethods)
        ? rule.selectedShippingMethods
        : [];
      if (normalize(rule.methodMatchMode) === "show") {
        hasAllowlist = true;
        for (const m of methods) showMatchers.push(m);
      } else {
        for (const m of methods) hideMatchers.push(m);
      }
    }

    // No rule covers this pincode: if an admin default shipping method is set,
    // show only the option(s) matching it and hide the rest. Empty default =
    // no change (every option shows).
    const defaultMethod = normalize(config?.settings?.defaultShippingMethod);
    if (!ruleMatched && defaultMethod) {
      for (const option of options) {
        const handle = normalize(option?.handle);
        if (!handle) continue;
        if (!optionMatchesText(option, defaultMethod)) {
          operations.push({ hide: { deliveryOptionHandle: handle } });
        }
      }
      continue;
    }

    for (const option of options) {
      const handle = normalize(option?.handle);
      if (!handle) continue;

      // Allowlist: hide anything that is not explicitly allowed.
      if (hasAllowlist && !methodMatches(showMatchers, option)) {
        operations.push({ hide: { deliveryOptionHandle: handle } });
        continue;
      }

      // Blocklist: hide explicitly blocked methods.
      if (hideMatchers.length > 0 && methodMatches(hideMatchers, option)) {
        operations.push({ hide: { deliveryOptionHandle: handle } });
        continue;
      }
    }
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parsePublishedConfig(input) {
  const value = input?.shop?.metafield?.value;
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.length > PUBLISHED_CONFIG_MAX_CHARS) return null;

  try {
    const parsed = JSON.parse(value);
    if (
      parsed?.v !== SUPPORTED_SCHEMA_VERSION ||
      parsed?.kind !== SUPPORTED_CONFIG_KIND ||
      !Array.isArray(parsed?.pincodeData?.records)
    ) {
      return null;
    }
    const rules = parsed.rules ?? {};
    parsed.rules = {
      ...rules,
      shippingHideRules: Array.isArray(rules.shippingHideRules)
        ? rules.shippingHideRules
        : [],
      shippingRenameRules: Array.isArray(rules.shippingRenameRules)
        ? rules.shippingRenameRules
        : [],
    };
    return parsed;
  } catch {
    return null;
  }
}

function findPincodeRecord(config, pincode) {
  if (!pincode) return null;
  const records = Array.isArray(config?.pincodeData?.records)
    ? config.pincodeData.records
    : [];
  return records.find((record) => normalize(record.pc) === pincode) ?? null;
}

/**
 * True when the customer's pincode is blocked / unserviceable, so no shipping
 * should be offered. Mirrors the checkout-validation block exactly, so shipping
 * is hidden precisely when the validation function shows a "not available"
 * error:
 *   1. Unknown pincode when "block unknown pincodes" is enabled.
 *   2. A product restriction (carrying a message) whose location conditions
 *      match. Product tags are NOT readable by Shopify Functions, so — exactly
 *      like the validation function — they do not narrow the match.
 */
function pincodeBlocked(config, pincode, pincodeRecord, cartTime, cartTags) {
  if (!pincode) return false;

  const settings = config?.settings ?? {};
  // "Block unknown pincodes" only makes sense when a known-pincode list exists.
  // With zero records EVERY pincode would look "unknown" and get blocked, which
  // is never the intent — so the guard is skipped when there are no records.
  const hasRecords =
    Array.isArray(config?.pincodeData?.records) &&
    config.pincodeData.records.length > 0;
  if (
    hasRecords &&
    settings.blockUnknownPincode === true &&
    !pincodeRecord &&
    normalize(settings.unknownPincodeMessage)
  ) {
    return true;
  }

  const restrictions = Array.isArray(config?.rules?.productRestrictions)
    ? config.rules.productRestrictions
    : [];
  for (const rule of restrictions) {
    if (!normalize(rule.validationMessage)) continue;
    if (!cutoffAllows(rule, config, cartTime)) continue;
    // Tag-scoped restriction (e.g. cow-milk) only blocks when the cart carries
    // the tag. Restrictions without a readable tag keep blocking as before.
    if (!tagConditionPasses(rule, cartTags, true)) continue;
    if (!restrictionLocationMatches(rule, pincode, pincodeRecord)) continue;
    return true;
  }
  return false;
}

/**
 * Location-only match for a product restriction, mirroring the validation
 * function's pincodeMatchesRule (explicit pincodes / area groups / delivery
 * availability text). Product tags are intentionally not considered here.
 */
function restrictionLocationMatches(rule, pincode, pincodeRecord) {
  const rulePincodes = expandPincodeValues(rule.pincodes);
  if (
    rulePincodes.length > 0 &&
    !rulePincodes.some((p) => pincodeMatchesPattern(pincode, p))
  )
    return false;

  const ruleAreaGroups = Array.isArray(rule.areaGroups) ? rule.areaGroups : [];
  if (ruleAreaGroups.length > 0) {
    if (!pincodeRecord) return false;
    if (!ruleAreaGroups.map(normalize).includes(normalize(pincodeRecord.ag))) {
      return false;
    }
  }

  const ruleDeliveryText = normalize(rule.deliveryAvailabilityText);
  if (ruleDeliveryText) {
    if (!pincodeRecord) return false;
    if (normalize(pincodeRecord.da) !== ruleDeliveryText) return false;
  }

  return true;
}

/**
 * True when a rule's pincode / area / delivery-text / cutoff / product-tag
 * conditions match this group.
 *
 * Tag handling is additive (see shippingRuleTagGate): plain pincode rules
 * always apply, and tag rules apply on top when the cart carries the tag. Tag
 * rules carry their own pincode/zone conditions so they only affect the zones
 * they target.
 */
function ruleMatchesContext(
  rule,
  pincode,
  pincodeRecord,
  config,
  cartTime,
  cartTags,
) {
  if (!cutoffAllows(rule, config, cartTime)) return false;
  if (!shippingRuleTagGate(rule, cartTags)) return false;
  if (!pincodeMatches(rule, pincode)) return false;
  if (!areaGroupMatches(rule, pincodeRecord)) return false;
  if (!deliveryAvailabilityMatches(rule, pincodeRecord)) return false;
  return true;
}

/**
 * Evaluates a rule's time-of-day (cutoff) condition.
 *
 * Rules without a cutoff always pass (unchanged behavior). Rules with a cutoff
 * fail safe: if the setting is missing or the cart time is absent/invalid, the
 * rule is treated as NOT applying (returns false), so we never hide/show based
 * on an unknown time.
 */
function cutoffAllows(rule, config, cartTime) {
  const cutoffId = normalize(rule?.cutoffRuleSettingId);
  if (!cutoffId) return true;

  const settings = Array.isArray(config?.rules?.cutoffSettings)
    ? config.rules.cutoffSettings
    : [];
  const setting = settings.find((entry) => normalize(entry?.id) === cutoffId);
  if (!setting) return false;

  const cartMinutes = parseTimeToMinutes(cartTime);
  if (cartMinutes === null) return false;

  const cutoffMinutes = parseTimeToMinutes(setting.timeValue);
  if (cutoffMinutes === null) return false;

  if (normalize(setting.matchMode) === "after") {
    return cartMinutes >= cutoffMinutes;
  }
  // Default (and explicit "before"): rule applies before the cutoff time.
  return cartMinutes < cutoffMinutes;
}

/**
 * Parses "HH:MM" (24h) or "hh:MM AM/PM" into minutes-since-midnight.
 * Returns null when the value is missing or unparseable.
 */
function parseTimeToMinutes(value) {
  const text = normalize(value);
  if (!text) return null;

  const meridiem = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(text);
  if (meridiem) {
    let hours = Number(meridiem[1]);
    const minutes = Number(meridiem[2]);
    const isPm = meridiem[3].toLowerCase() === "pm";
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (hours === 12) hours = 0;
    if (isPm) hours += 12;
    return hours * 60 + minutes;
  }

  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    const minutes = Number(twentyFour[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  return null;
}

/** True when any matcher entry matches the delivery option. */
function methodMatches(matchers, option) {
  if (!Array.isArray(matchers) || matchers.length === 0) return false;
  return matchers.some((entry) => entryMatchesOption(entry, option));
}

function entryMatchesOption(entry, option) {
  const value = normalize(entry?.value ?? entry?.matchValue);
  if (!value) return false;
  const candidates = [
    normalize(option?.title),
    normalize(option?.code),
    normalize(option?.handle),
  ].filter(Boolean);
  const operator = normalize(entry?.operator);
  switch (operator) {
    case "contains":
      return candidates.some((c) => c.includes(value));
    case "starts_with":
    case "startswith":
      return candidates.some((c) => c.startsWith(value));
    case "ends_with":
    case "endswith":
      return candidates.some((c) => c.endsWith(value));
    default:
      return candidates.some((c) => c === value);
  }
}

/** True when any of the option's identifiers contains the given text (ci). */
function optionMatchesText(option, text) {
  const needle = text.toLowerCase();
  if (!needle) return false;
  const candidates = [
    normalize(option?.title),
    normalize(option?.code),
    normalize(option?.handle),
  ];
  return candidates.some((candidate) => candidate.toLowerCase().includes(needle));
}

function pincodeMatches(rule, pincode) {
  const patterns = expandPincodeValues(rule.pincodes);
  if (patterns.length === 0) return true;
  return patterns.some((p) => pincodeMatchesPattern(pincode, p));
}

/**
 * Splits the rule's pincode entries into tokens. Entries can be exact 6-digit
 * codes ("110016"), comma/space separated lists, prefixes ("400"), or wildcard
 * patterns ("400*"). Prefixes let one rule cover a whole courier zone (e.g.
 * "400*" = all Mumbai) without listing hundreds of zipcodes, keeping the
 * published config under the 10KB function limit.
 */
function expandPincodeValues(value) {
  const rawValues = Array.isArray(value) ? value : [];
  const out = [];
  for (const item of rawValues) {
    const text = normalize(item);
    if (!text) continue;
    // Fast path: a single token (no comma/space) is used as-is. Avoids running
    // a split regex for every pincode entry (which blew the instruction limit).
    if (text.indexOf(",") === -1 && text.indexOf(" ") === -1) {
      out.push(text);
    } else {
      for (const token of text.split(/[\s,]+/)) {
        if (token) out.push(token);
      }
    }
  }
  return out;
}

/**
 * Matches a 6-digit pincode against an exact code ("110001"), a numeric prefix
 * ("400" → all 400xxx), or a wildcard ("400*"). NO regex on the exact/prefix
 * paths — those run for every pincode of every rule and regex there exhausted
 * the Wasm instruction limit.
 */
function pincodeMatchesPattern(pincode, pattern) {
  if (!pincode || !pattern) return false;
  const star = pattern.indexOf("*") !== -1 || pattern.indexOf("?") !== -1;
  if (!star) {
    // Range "560001-560066": inclusive numeric match. The published config
    // compresses consecutive pincode runs into ranges so the metafield stays
    // small (keeps the Function well under the Wasm instruction limit) WITHOUT
    // over-matching — only the exact listed pincodes are covered, unlike a
    // "560*" prefix which would also match unlisted 560xxx codes. Two integer
    // comparisons, no regex.
    const dash = pattern.indexOf("-");
    if (dash > 0) {
      const lo = Number(pattern.slice(0, dash));
      const hi = Number(pattern.slice(dash + 1));
      const p = Number(pincode);
      return lo > 0 && hi > 0 && p >= lo && p <= hi;
    }
    // Exact when same length, prefix when shorter — plain string ops, no regex.
    if (pattern.length === pincode.length) return pattern === pincode;
    if (pattern.length < pincode.length) return pincode.startsWith(pattern);
    return false;
  }
  // Trailing "*" only (e.g. "400*") = prefix match — plain startsWith, no regex.
  if (
    pattern.indexOf("?") === -1 &&
    pattern.indexOf("*") === pattern.length - 1
  ) {
    return pincode.startsWith(pattern.slice(0, -1));
  }
  const regex =
    "^" +
    pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "\\d*")
      .replace(/\?/g, "\\d") +
    "$";
  try {
    return new RegExp(regex).test(pincode);
  } catch {
    return false;
  }
}

function areaGroupMatches(rule, pincodeRecord) {
  if (!Array.isArray(rule.areaGroups) || rule.areaGroups.length === 0) return true;
  if (!pincodeRecord) return false;
  return rule.areaGroups.map(normalize).includes(normalize(pincodeRecord.ag));
}

function deliveryAvailabilityMatches(rule, pincodeRecord) {
  const text = normalize(rule.deliveryAvailabilityText);
  if (!text) return true;
  if (!pincodeRecord) return false;
  return normalize(pincodeRecord.da) === text;
}

/** Collects the readable product tags present on any line in the cart. */
function collectCartTags(input) {
  const tags = new Set();
  const lines = Array.isArray(input?.cart?.lines) ? input.cart.lines : [];
  for (const line of lines) {
    const hasTags = line?.merchandise?.product?.hasTags;
    if (!Array.isArray(hasTags)) continue;
    for (const entry of hasTags) {
      if (entry?.hasTag === true) tags.add(normalize(entry.tag));
    }
  }
  return tags;
}

/**
 * Tag gate for shipping show/hide rules (see ruleMatchesContext). ADDITIVE:
 * tag rules and plain (no-tag) rules combine instead of switching modes.
 *
 * - No tag condition -> always passes (so pincode-based rules like the
 *   Delhi-NCR Near/Average/Far keep working even when cart products carry
 *   tags). This is the key fix that stops tagged products from disabling the
 *   existing zone rules.
 * - Readable tag (READABLE_TAGS) -> passes only when the cart carries it.
 * - Unreadable tag -> skipped (return false), as before.
 *
 * Tag rules are expected to also carry pincode/zone conditions, so they only
 * match the zones they target and never union with the Delhi-NCR rules.
 */
function shippingRuleTagGate(rule, cartTags) {
  const tags = cartTags instanceof Set ? cartTags : new Set();
  const ruleTags = (Array.isArray(rule.productTags) ? rule.productTags : [])
    .map(normalize)
    .filter(Boolean);

  // Exclusive mode: the cart carries a take-over tag (e.g. cow-milk). Only
  // rules scoped to a present exclusive tag apply; everything else is skipped.
  const cartExclusive = [...tags].filter((tag) => EXCLUSIVE_TAGS.includes(tag));
  if (cartExclusive.length > 0) {
    return ruleTags.some(
      (tag) => EXCLUSIVE_TAGS.includes(tag) && tags.has(tag),
    );
  }

  // Additive mode: plain zone rules always apply; tag rules apply when the
  // cart carries the (readable) tag.
  if (ruleTags.length === 0) return true;
  const enforceable = ruleTags.filter((tag) => READABLE_TAGS.includes(tag));
  if (enforceable.length === 0) return false;
  return enforceable.some((tag) => tags.has(tag));
}

/**
 * Evaluates a rule's product-tag condition for BLOCK paths (validation mirror).
 *
 * - No tag condition -> always passes.
 * - Tags the Function can read (READABLE_TAGS) -> pass only when the cart
 *   carries at least one of them.
 * - Tags the Function cannot read -> fall back to `fallbackWhenUnreadable`,
 *   which preserves the pre-tag behavior (block paths pass).
 */
function tagConditionPasses(rule, cartTags, fallbackWhenUnreadable) {
  const ruleTags = (Array.isArray(rule.productTags) ? rule.productTags : [])
    .map(normalize)
    .filter(Boolean);
  if (ruleTags.length === 0) return true;
  const enforceable = ruleTags.filter((tag) => READABLE_TAGS.includes(tag));
  if (enforceable.length === 0) return fallbackWhenUnreadable;
  const tags = cartTags instanceof Set ? cartTags : new Set();
  const has = enforceable.some((tag) => tags.has(tag));
  // "not_has": condition is satisfied when the cart is MISSING the tag (used to
  // block products in zones their reach tag does not cover).
  return normalize(rule.productTagMode) === "not_has" ? !has : has;
}

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}
