-- AlterTable: add selectedShippingMethodsJson to ShippingHideRule
ALTER TABLE "ShippingHideRule" ADD COLUMN "selectedShippingMethodsJson" TEXT NOT NULL DEFAULT '[]';

-- AlterTable: add selectedShippingMethodsJson to ShippingRenameRule
ALTER TABLE "ShippingRenameRule" ADD COLUMN "selectedShippingMethodsJson" TEXT NOT NULL DEFAULT '[]';

-- AlterTable: add selectedPaymentMethodsJson to PaymentHideRule
ALTER TABLE "PaymentHideRule" ADD COLUMN "selectedPaymentMethodsJson" TEXT NOT NULL DEFAULT '[]';
