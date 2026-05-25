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
  notes: string;
};

export type PublishedProductRestrictionRule = {
  id: string;
  name: string;
  priority: number;
  productTags: string[];
  pincodes: string[];
  areaGroups: string[];
  deliveryAvailabilityText: string;
  validationMessage: string;
  notes: string;
};

export type PublishedShippingHideRule = {
  id: string;
  name: string;
  priority: number;
  shippingMethodMappingId: string;
  cutoffRuleSettingId: string;
  productTags: string[];
  pincodes: string[];
  areaGroups: string[];
  deliveryAvailabilityText: string;
  notes: string;
};

export type PublishedShippingRenameRule = PublishedShippingHideRule & {
  newLabel: string;
};

export type PublishedPaymentHideRule = {
  id: string;
  name: string;
  priority: number;
  paymentMethodMappingId: string;
  cutoffRuleSettingId: string;
  selectedShippingContains: string;
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
