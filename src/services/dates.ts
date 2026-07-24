import type { DayKey } from "../types";

export function toDayKey(date: Date): DayKey {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return {
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    year,
    month,
    day
  };
}

export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function stableSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function pickBySeed<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length];
}

export function monthName(month: number): string {
  return [
    "Januar",
    "Februar",
    "Maerz",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember"
  ][month - 1];
}
