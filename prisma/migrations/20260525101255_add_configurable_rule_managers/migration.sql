-- CreateTable
CREATE TABLE "ProductRestrictionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "productTagsJson" TEXT NOT NULL DEFAULT '[]',
    "pincodesJson" TEXT NOT NULL DEFAULT '[]',
    "areaGroupsJson" TEXT NOT NULL DEFAULT '[]',
    "deliveryAvailabilityText" TEXT NOT NULL DEFAULT '',
    "validationMessage" TEXT NOT NULL DEFAULT '',
    "conditionsJson" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShippingMethodMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "matchType" TEXT NOT NULL DEFAULT 'exact',
    "matchValue" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaymentMethodMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "matchType" TEXT NOT NULL DEFAULT 'exact',
    "matchValue" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CutoffRuleSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "timeValue" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT '',
    "matchMode" TEXT NOT NULL DEFAULT 'before',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShippingHideRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "shippingMethodMappingId" TEXT NOT NULL DEFAULT '',
    "cutoffRuleSettingId" TEXT NOT NULL DEFAULT '',
    "productTagsJson" TEXT NOT NULL DEFAULT '[]',
    "pincodesJson" TEXT NOT NULL DEFAULT '[]',
    "areaGroupsJson" TEXT NOT NULL DEFAULT '[]',
    "deliveryAvailabilityText" TEXT NOT NULL DEFAULT '',
    "conditionsJson" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShippingRenameRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "shippingMethodMappingId" TEXT NOT NULL DEFAULT '',
    "cutoffRuleSettingId" TEXT NOT NULL DEFAULT '',
    "newLabel" TEXT NOT NULL DEFAULT '',
    "productTagsJson" TEXT NOT NULL DEFAULT '[]',
    "pincodesJson" TEXT NOT NULL DEFAULT '[]',
    "areaGroupsJson" TEXT NOT NULL DEFAULT '[]',
    "deliveryAvailabilityText" TEXT NOT NULL DEFAULT '',
    "conditionsJson" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaymentHideRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "paymentMethodMappingId" TEXT NOT NULL DEFAULT '',
    "cutoffRuleSettingId" TEXT NOT NULL DEFAULT '',
    "selectedShippingContains" TEXT NOT NULL DEFAULT '',
    "productTagsJson" TEXT NOT NULL DEFAULT '[]',
    "pincodesJson" TEXT NOT NULL DEFAULT '[]',
    "areaGroupsJson" TEXT NOT NULL DEFAULT '[]',
    "deliveryAvailabilityText" TEXT NOT NULL DEFAULT '',
    "conditionsJson" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ProductRestrictionRule_enabled_idx" ON "ProductRestrictionRule"("enabled");

-- CreateIndex
CREATE INDEX "ProductRestrictionRule_priority_idx" ON "ProductRestrictionRule"("priority");

-- CreateIndex
CREATE INDEX "ShippingMethodMapping_enabled_idx" ON "ShippingMethodMapping"("enabled");

-- CreateIndex
CREATE INDEX "ShippingMethodMapping_priority_idx" ON "ShippingMethodMapping"("priority");

-- CreateIndex
CREATE INDEX "PaymentMethodMapping_enabled_idx" ON "PaymentMethodMapping"("enabled");

-- CreateIndex
CREATE INDEX "PaymentMethodMapping_priority_idx" ON "PaymentMethodMapping"("priority");

-- CreateIndex
CREATE INDEX "CutoffRuleSetting_enabled_idx" ON "CutoffRuleSetting"("enabled");

-- CreateIndex
CREATE INDEX "CutoffRuleSetting_priority_idx" ON "CutoffRuleSetting"("priority");

-- CreateIndex
CREATE INDEX "ShippingHideRule_enabled_idx" ON "ShippingHideRule"("enabled");

-- CreateIndex
CREATE INDEX "ShippingHideRule_priority_idx" ON "ShippingHideRule"("priority");

-- CreateIndex
CREATE INDEX "ShippingHideRule_shippingMethodMappingId_idx" ON "ShippingHideRule"("shippingMethodMappingId");

-- CreateIndex
CREATE INDEX "ShippingRenameRule_enabled_idx" ON "ShippingRenameRule"("enabled");

-- CreateIndex
CREATE INDEX "ShippingRenameRule_priority_idx" ON "ShippingRenameRule"("priority");

-- CreateIndex
CREATE INDEX "ShippingRenameRule_shippingMethodMappingId_idx" ON "ShippingRenameRule"("shippingMethodMappingId");

-- CreateIndex
CREATE INDEX "PaymentHideRule_enabled_idx" ON "PaymentHideRule"("enabled");

-- CreateIndex
CREATE INDEX "PaymentHideRule_priority_idx" ON "PaymentHideRule"("priority");

-- CreateIndex
CREATE INDEX "PaymentHideRule_paymentMethodMappingId_idx" ON "PaymentHideRule"("paymentMethodMappingId");
