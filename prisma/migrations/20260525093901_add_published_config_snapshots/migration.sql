-- CreateTable
CREATE TABLE "PublishedConfigSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "metafieldId" TEXT NOT NULL DEFAULT '',
    "sourceBatchId" TEXT,
    "sourceFilename" TEXT NOT NULL DEFAULT '',
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "payloadSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "payloadJson" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublishedConfigSnapshot_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "PincodeImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PublishedConfigSnapshot_status_idx" ON "PublishedConfigSnapshot"("status");

-- CreateIndex
CREATE INDEX "PublishedConfigSnapshot_shop_idx" ON "PublishedConfigSnapshot"("shop");

-- CreateIndex
CREATE INDEX "PublishedConfigSnapshot_sourceBatchId_idx" ON "PublishedConfigSnapshot"("sourceBatchId");
