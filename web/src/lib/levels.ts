// Shared level constants for JLPT and CEFR levels

export type LevelVariant = "n5" | "n4" | "n3" | "n2" | "n1" | "a1" | "a2" | "b1" | "b2" | "c1" | "c2";

export const levelVariantMap: Record<string, LevelVariant> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
  A1: "a1",
  A2: "a2",
  B1: "b1",
  B2: "b2",
  C1: "c1",
  C2: "c2",
};

export function getLevelVariant(level: string | undefined): LevelVariant | undefined {
  if (!level) return undefined;
  return levelVariantMap[level];
}
