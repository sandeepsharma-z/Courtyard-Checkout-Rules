import {
  reactExtension,
  Banner,
  useAppMetafields,
} from "@shopify/ui-extensions-react/checkout";

// Non-blocking holiday notice. Reads the published config metafield (the same
// one the delivery Function uses) and shows the admin-set message when the
// publish step has flagged today/tomorrow as a holiday. All date logic is done
// server-side (holidayBannerActive is baked at publish/cron), so this just
// shows or hides a banner — works on every checkout path.
export default reactExtension(
  "purchase.checkout.delivery-address.render-after",
  () => <HolidayBanner />,
);

function HolidayBanner() {
  const appMetafields = useAppMetafields();
  const entry = appMetafields.find(
    (m) =>
      m?.target?.type === "shop" &&
      m?.metafield?.namespace === "courtyard_checkout_rules" &&
      m?.metafield?.key === "published_config",
  );

  const raw = entry?.metafield?.value;
  if (!raw) return null;

  let settings;
  try {
    settings = JSON.parse(raw)?.settings;
  } catch (error) {
    return null;
  }

  if (
    !settings ||
    settings.holidayBannerEnabled !== true ||
    settings.holidayBannerActive !== true
  ) {
    return null;
  }

  const message =
    String(settings.holidayMessage || "").trim() ||
    "An upcoming holiday may add an extra business day to your delivery.";

  return <Banner status="info" title={message} />;
}
