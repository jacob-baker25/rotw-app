export const ROOMMATES = ["Jacob", "Will", "Brandon", "Cole", "Tommy", "Xan"];
export const TIME_ZONE = "America/New_York";

export function easternParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function currentWeek(now = new Date()) {
  const parts = easternParts(now);
  const utcDate = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
  const day = utcDate.getUTCDay();
  utcDate.setUTCDate(utcDate.getUTCDate() + ((7 - day) % 7));
  return {
    weekEnd: utcDate.toISOString().slice(0, 10),
    votingOpen: day === 0,
  };
}

export function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function validName(value) {
  const name = normalizeName(value);
  return (
    name.length >= 2 && name.length <= 40 && /^[\p{L}\p{M}.' -]+$/u.test(name)
  );
}
