import prisma from "../db.server";

export type PincodeGroupInput = {
  name: string;
  pincodes: string; // comma/space/newline separated, may include prefixes like "400*"
  notes?: string;
};

const toJson = (pincodes: string) =>
  JSON.stringify(
    Array.from(
      new Set(
        String(pincodes ?? "")
          .split(/[\s,]+/)
          .map((p) => p.trim())
          .filter(Boolean),
      ),
    ),
  );

export const listPincodeGroups = () =>
  prisma.pincodeGroup.findMany({ orderBy: { name: "asc" } });

export const getPincodeGroupMap = async () => {
  const groups = await prisma.pincodeGroup.findMany();
  const map = new Map<string, string[]>();
  for (const g of groups) {
    try {
      map.set(g.id, JSON.parse(g.pincodesJson) as string[]);
    } catch {
      map.set(g.id, []);
    }
  }
  return map;
};

export const createPincodeGroup = (input: PincodeGroupInput) =>
  prisma.pincodeGroup.create({
    data: {
      name: input.name.trim() || "Untitled group",
      pincodesJson: toJson(input.pincodes),
      notes: (input.notes ?? "").trim(),
    },
  });

export const updatePincodeGroup = (id: string, input: PincodeGroupInput) =>
  prisma.pincodeGroup.update({
    where: { id },
    data: {
      name: input.name.trim() || "Untitled group",
      pincodesJson: toJson(input.pincodes),
      notes: (input.notes ?? "").trim(),
    },
  });

export const deletePincodeGroup = (id: string) =>
  prisma.pincodeGroup.delete({ where: { id } });
