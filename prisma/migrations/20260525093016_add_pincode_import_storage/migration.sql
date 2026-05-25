-- CreateTable
CREATE TABLE "PincodeImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'previewed',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "missingHeadersJson" TEXT NOT NULL DEFAULT '[]',
    "extraHeadersJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "approvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "PincodeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rowStatus" TEXT NOT NULL,
    "rowErrorsJson" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL DEFAULT '',
    "district" TEXT NOT NULL DEFAULT '',
    "pincode" TEXT NOT NULL DEFAULT '',
    "locationName" TEXT NOT NULL DEFAULT '',
    "areaGroup" TEXT NOT NULL DEFAULT '',
    "deliveryAvailability" TEXT NOT NULL DEFAULT '',
    "sameDayDeliveryRule" TEXT NOT NULL DEFAULT '',
    "nextDayDeliveryRule" TEXT NOT NULL DEFAULT '',
    "productAvailabilityRule" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',
    "chargesPricingText" TEXT NOT NULL DEFAULT '',
    "updatedSameDayRule" TEXT NOT NULL DEFAULT '',
    "updatedNextDayRule" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PincodeRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PincodeImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PincodeRecord_batchId_idx" ON "PincodeRecord"("batchId");

-- CreateIndex
CREATE INDEX "PincodeRecord_isActive_idx" ON "PincodeRecord"("isActive");

-- CreateIndex
CREATE INDEX "PincodeRecord_pincode_idx" ON "PincodeRecord"("pincode");
