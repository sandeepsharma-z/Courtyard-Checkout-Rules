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

// Maps a pincode group's NAME to the product reach tag it defines. Convention:
// name the group after the tag — "NT2", "Mumbai", "MT2", "DNCR" (case-
// insensitive, keyword match). The Delhi delivery-SPEED groups (90 Min,
// Delhi NCR, Far, Blocked) deliberately map to nothing, so they are never
// treated as product-tag reach zones. Order matters: check the more specific
// keywords before "mum"/"mumbai".
export const reachTagForGroupName = (name: string): string | null => {
  const n = String(name ?? "").toLowerCase();
  if (n.includes("dncr")) return "DNCR";
  if (n.includes("nt2")) return "NT2";
  if (n.includes("mt2")) return "MT2";
  if (n.includes("mumbai") || n.includes("mum")) return "Mum";
  return null;
};

// Builds tag -> pincodes (one entry per reach tag) from the groups, merging the
// pincodes of every group whose name maps to that tag. Used to publish the
// per-tag reach zones the delivery Function enforces.
export const getReachTagZones = async () => {
  const groups = await prisma.pincodeGroup.findMany();
  const zones: Record<string, string[]> = {};
  for (const g of groups) {
    const tag = reachTagForGroupName(g.name);
    if (!tag) continue;
    let pincodes: string[] = [];
    try {
      pincodes = JSON.parse(g.pincodesJson) as string[];
    } catch {
      pincodes = [];
    }
    if (!zones[tag]) zones[tag] = [];
    for (const p of pincodes) {
      const t = String(p ?? "").trim();
      if (t) zones[tag].push(t);
    }
  }
  return zones;
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
