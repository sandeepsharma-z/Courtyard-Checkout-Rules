/**
 * Courtyard Checkout Time embed.
 *
 * Shopify Functions cannot read the current wall-clock time, so this script
 * writes the current shop-local time ("HH:MM", 24h) into a cart attribute
 * named "_courtyard_time" via the Cart AJAX API. The delivery and validation
 * functions read that attribute to evaluate time-of-day (cutoff) conditions.
 *
 * Defensive by design: never throws, only updates when the value changes.
 */
(function () {
  "use strict";

  var ATTRIBUTE_KEY = "_courtyard_time";
  var DEFAULT_TIMEZONE = "Asia/Kolkata";

  function getTimezone() {
    try {
      var script = document.currentScript;
      var tz = script && script.getAttribute("data-timezone");
      return tz && tz.trim() ? tz.trim() : DEFAULT_TIMEZONE;
    } catch (error) {
      return DEFAULT_TIMEZONE;
    }
  }

  function computeTime(timeZone) {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
    } catch (error) {
      return null;
    }
  }

  function updateCartTime(timeZone) {
    var value = computeTime(timeZone);
    if (!value || typeof fetch !== "function") return;

    // Skip the network call if we already wrote this exact value.
    try {
      if (window.__courtyardTime === value) return;
    } catch (error) {
      // Ignore and continue with the update.
    }

    var attributes = {};
    attributes[ATTRIBUTE_KEY] = value;

    try {
      fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes: attributes }),
      })
        .then(function () {
          try {
            window.__courtyardTime = value;
          } catch (error) {
            // Ignore.
          }
        })
        .catch(function () {
          // Ignore network errors; functions fail safe when the attribute is absent.
        });
    } catch (error) {
      // Ignore.
    }
  }

  var timeZone = getTimezone();

  function run() {
    updateCartTime(timeZone);
  }

  try {
    run();
    // Refresh on focus so a long-open tab still reports a current time.
    window.addEventListener("focus", run);
  } catch (error) {
    // Ignore.
  }
})();
