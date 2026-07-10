import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/** وحدات البيع الأساسية المدمجة. */
export const BASE_UNITS = [
  "KG",
  "Box",
  "Carton",
  "Bunch",
  "Piece",
  "Pkt125",
  "Pkt170",
  "Pkt250",
];

/** للتوافق: قائمة ثابتة عند عدم الحاجة للوحدات المخصّصة. */
export const UNITS = BASE_UNITS;

export function parseCustomUnits(raw?: string): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** كل الوحدات = الأساسية + المخصّصة المحفوظة في الإعدادات (settings.customUnits). */
export function useUnits(): string[] {
  const settings = useQuery(api.settings.all, {});
  return [...new Set([...BASE_UNITS, ...parseCustomUnits(settings?.customUnits)])];
}
