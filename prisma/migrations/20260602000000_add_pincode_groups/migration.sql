-- CreateTable
CREATE TABLE "PincodeGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pincodesJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PincodeGroup_pkey" PRIMARY KEY ("id")
);
