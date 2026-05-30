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
