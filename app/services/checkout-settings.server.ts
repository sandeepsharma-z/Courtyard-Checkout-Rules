import prisma from "../db.server";

export const CHECKOUT_SETTING_KEYS = {
  blockUnknownPincode: "block_unknown_pincode",
  unknownPincodeMessage: "unknown_pincode_message",
  autoRenameDeliveryOption: "auto_rename_delivery_option",
  deliveryLabelSource: "delivery_label_source",
  hideOtherDeliveryOptions: "hide_other_delivery_options",
  defaultShippingMethod: "default_shipping_method",
  holidayBannerEnabled: "holiday_banner_enabled",
  holidayMessage: "holiday_message",
  holidayDates: "holiday_dates",
  holidayWeeklyOffSunday: "holiday_weekly_off_sunday",
} as const;

export type CheckoutRuleSettings = {
  blockUnknownPincode: boolean;
  unknownPincodeMessage: string;
  autoRenameDeliveryOption: boolean;
  deliveryLabelSource: "same_day" | "next_day" | "updated_first";
  hideOtherDeliveryOptions: boolean;
  // For pincodes not matched by any shipping rule, show ONLY the delivery
  // option(s) whose name contains this text (e.g. "5-8 Days Delivery"). Empty
  // means no change (all options show).
  defaultShippingMethod: string;
  // Holiday banner (shown by the checkout-ui "holiday-banner" extension). The
  // publish step computes whether today/tomorrow is a holiday and bakes the
  // result + message into the published metafield; the extension only reads it.
  holidayBannerEnabled: boolean;
  holidayMessage: string;
  // Comma/space/newline separated YYYY-MM-DD dates that count as holidays.
  holidayDates: string;
  holidayWeeklyOffSunday: boolean;
};

export const DEFAULT_CHECKOUT_RULE_SETTINGS: CheckoutRuleSettings = {
  blockUnknownPincode: false,
  unknownPincodeMessage: "",
  autoRenameDeliveryOption: false,
  deliveryLabelSource: "updated_first",
  hideOtherDeliveryOptions: false,
  defaultShippingMethod: "",
  holidayBannerEnabled: false,
  holidayMessage: "",
  holidayDates: "",
  holidayWeeklyOffSunday: false,
};

export async function getCheckoutRuleSettings(): Promise<CheckoutRuleSettings> {
  const settings = await prisma.checkoutRuleSetting.findMany();
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    blockUnknownPincode:
      values.get(CHECKOUT_SETTING_KEYS.blockUnknownPincode) === "true",
    unknownPincodeMessage:
      values.get(CHECKOUT_SETTING_KEYS.unknownPincodeMessage) ??
      DEFAULT_CHECKOUT_RULE_SETTINGS.unknownPincodeMessage,
    autoRenameDeliveryOption:
      values.get(CHECKOUT_SETTING_KEYS.autoRenameDeliveryOption) === "true",
    deliveryLabelSource:
      parseDeliveryLabelSource(
        values.get(CHECKOUT_SETTING_KEYS.deliveryLabelSource),
    ),
    hideOtherDeliveryOptions:
      values.get(CHECKOUT_SETTING_KEYS.hideOtherDeliveryOptions) === "true",
    defaultShippingMethod:
      values.get(CHECKOUT_SETTING_KEYS.defaultShippingMethod) ??
      DEFAULT_CHECKOUT_RULE_SETTINGS.defaultShippingMethod,
    holidayBannerEnabled:
      values.get(CHECKOUT_SETTING_KEYS.holidayBannerEnabled) === "true",
    holidayMessage:
      values.get(CHECKOUT_SETTING_KEYS.holidayMessage) ??
      DEFAULT_CHECKOUT_RULE_SETTINGS.holidayMessage,
    holidayDates:
      values.get(CHECKOUT_SETTING_KEYS.holidayDates) ??
      DEFAULT_CHECKOUT_RULE_SETTINGS.holidayDates,
    holidayWeeklyOffSunday:
      values.get(CHECKOUT_SETTING_KEYS.holidayWeeklyOffSunday) === "true",
  };
}

export async function saveCheckoutRuleSettings(input: CheckoutRuleSettings) {
  await prisma.$transaction([
    upsertSetting(
      CHECKOUT_SETTING_KEYS.blockUnknownPincode,
      String(input.blockUnknownPincode),
    ),
    upsertSetting(
      CHECKOUT_SETTING_KEYS.unknownPincodeMessage,
      input.unknownPincodeMessage,
    ),
    upsertSetting(
      CHECKOUT_SETTING_KEYS.autoRenameDeliveryOption,
      String(input.autoRenameDeliveryOption),
    ),
    upsertSetting(CHECKOUT_SETTING_KEYS.deliveryLabelSource, input.deliveryLabelSource),
    upsertSetting(
      CHECKOUT_SETTING_KEYS.hideOtherDeliveryOptions,
      String(input.hideOtherDeliveryOptions),
    ),
    upsertSetting(
      CHECKOUT_SETTING_KEYS.defaultShippingMethod,
      input.defaultShippingMethod,
    ),
    upsertSetting(
      CHECKOUT_SETTING_KEYS.holidayBannerEnabled,
      String(input.holidayBannerEnabled),
    ),
    upsertSetting(CHECKOUT_SETTING_KEYS.holidayMessage, input.holidayMessage),
    upsertSetting(CHECKOUT_SETTING_KEYS.holidayDates, input.holidayDates),
    upsertSetting(
      CHECKOUT_SETTING_KEYS.holidayWeeklyOffSunday,
      String(input.holidayWeeklyOffSunday),
    ),
  ]);
}

function upsertSetting(key: string, value: string) {
  return prisma.checkoutRuleSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

function parseDeliveryLabelSource(
  value?: string,
): CheckoutRuleSettings["deliveryLabelSource"] {
  if (value === "same_day" || value === "next_day" || value === "updated_first") {
    return value;
  }
  return DEFAULT_CHECKOUT_RULE_SETTINGS.deliveryLabelSource;
}
