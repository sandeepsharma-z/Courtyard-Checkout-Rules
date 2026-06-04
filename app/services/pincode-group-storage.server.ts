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

// A group whose NAME carries this marker is a dedicated product-tag reach zone
// (e.g. "DNCR (Product Tag)"). Only these feed tagZones — the big delivery-zone
// groups (NT2/Mumbai/MT2/Delhi NCR/90 Min/Far) are covered by the shipping
// rules instead, so tagZones stays tiny (no instruction-limit bloat).
const PRODUCT_TAG_MARKER = "(product tag)";

const reachTagForGroupName = (name: string): string | null => {
  const n = String(name ?? "").toLowerCase();
  if (n.includes("nt2")) return "NT2";
  if (n.includes("mt2")) return "MT2";
  if (n.includes("mumbai") || n.includes("mum")) return "Mum";
  if (n.includes("dncr") || n.includes("delhi ncr")) return "DNCR";
  return null;
};

// tag -> pincodes built ONLY from the dedicated "(Product Tag)" groups, so the
// delivery Function can serve reach tags at pincodes no shipping rule lists
// (e.g. the DNCR outer pincodes that live in the DNCR product-tag group but no
// rule). Kept small on purpose.
export const getProductTagZones = async () => {
  const groups = await prisma.pincodeGroup.findMany();
  const zones: Record<string, string[]> = {};
  for (const g of groups) {
    if (!String(g.name ?? "").toLowerCase().includes(PRODUCT_TAG_MARKER)) {
      continue;
    }
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
