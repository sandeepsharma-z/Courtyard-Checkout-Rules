import prisma from "../db.server";

export const CHECKOUT_SETTING_KEYS = {
  blockUnknownPincode: "block_unknown_pincode",
  unknownPincodeMessage: "unknown_pincode_message",
  autoRenameDeliveryOption: "auto_rename_delivery_option",
  deliveryLabelSource: "delivery_label_source",
  hideOtherDeliveryOptions: "hide_other_delivery_options",
  defaultShippingMethod: "default_shipping_method",
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
};

export const DEFAULT_CHECKOUT_RULE_SETTINGS: CheckoutRuleSettings = {
  blockUnknownPincode: false,
  unknownPincodeMessage: "",
  autoRenameDeliveryOption: false,
  deliveryLabelSource: "updated_first",
  hideOtherDeliveryOptions: false,
  defaultShippingMethod: "",
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
