export type MatchType = "exact" | "contains";

export type PublishedMethodMapping = {
  id: string;
  name: string;
  priority: number;
  matchType: MatchType;
  matchValue: string;
  notes: string;
};

export type PublishedCutoffSetting = {
  id: string;
  name: string;
  priority: number;
  timeValue: string;
  timezone: string;
  matchMode: string;
  // Whether the shop-local clock currently satisfies this cutoff. Baked at
  // publish time (and refreshed by the scheduled cron) so the delivery Function
  // can apply the cutoff on every checkout path — including "Buy it now" and
  // Shop Pay — without depending on a cart attribute that express checkouts skip.
  activeNow?: boolean | null;
  notes: string;
};

export type PublishedProductRestrictionRule = {
  id: string;
  name: string;
  priority: number;
  productTags: string[];
  productTagMode?: "has" | "not_has";
  pincodes: string[];
  areaGroups: string[];
  deliveryAvailabilityText: string;
  validationMessage: string;
  notes: string;
};

export type PublishedSelectedShippingMethod = {
  operator: string;
  value: string;
};

export type PublishedSelectedRenameMethod = {
  operator: string;
  matchValue: string;
  newLabel: string;
};

export type PublishedSelectedPaymentMethod = {
  operator: string;
  value: string;
};

export type PublishedShippingHideRule = {
  id: string;
  name: string;
  priority: number;
  shippingMethodMappingId: string;
  selectedShippingMethods: PublishedSelectedShippingMethod[];
  methodMatchMode: string;
  cutoffRuleSettingId: string;
  productTags: string[];
  pincodes: string[];
  areaGroups: string[];
  deliveryAvailabilityText: string;
  notes: string;
};

export type PublishedShippingRenameRule = {
  id: string;
  name: string;
  priority: number;
  shippingMethodMappingId: string;
  selectedShippingMethods: PublishedSelectedRenameMethod[];
  cutoffRuleSettingId: string;
  newLabel: string;
  productTags: string[];
  pincodes: string[];
  areaGroups: string[];
  deliveryAvailabilityText: string;
  notes: string;
};

export type PublishedPaymentHideRule = {
  id: string;
  name: string;
  priority: number;
  paymentMethodMappingId: string;
  selectedPaymentMethods: PublishedSelectedPaymentMethod[];
  cutoffRuleSettingId: string;
  selectedShippingContains: string;
  pincodeMatchMode: "has" | "not_has";
  productTags: string[];
  pincodes: string[];
  areaGroups: string[];
  deliveryAvailabilityText: string;
  notes: string;
};

export type PublishedRuleConfig = {
  productRestrictions: PublishedProductRestrictionRule[];
  shippingMethodMappings: PublishedMethodMapping[];
  paymentMethodMappings: PublishedMethodMapping[];
  shippingHideRules: PublishedShippingHideRule[];
  shippingRenameRules: PublishedShippingRenameRule[];
  paymentHideRules: PublishedPaymentHideRule[];
  cutoffSettings: PublishedCutoffSetting[];
};
