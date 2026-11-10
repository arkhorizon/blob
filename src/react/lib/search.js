function normalize(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export const TIME_RANGES = [
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
  { value: "year", label: "本年" },
];

function parseEssayDate(value) {
  const match = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function matchesDateRange(essay, range) {
  if (range === "all" || !range) return true;

  const date = parseEssayDate(essay.date);
  if (!date) return false;

  const today = startOfToday();
  if (range === "week") {
    const offsetFromMonday = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - offsetFromMonday);
    return date >= monday;
  }
  if (range === "month") {
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  }
  if (range === "year") return date.getFullYear() === today.getFullYear();
  return true;
}

export function matchesEssaySearch(essay, rawQuery) {
  const query = normalize(rawQuery).trim();
  if (!query) return true;

  return [essay.title, essay.summary, essay.author, essay.translator, ...(essay.tags ?? [])].some(
    (value) => normalize(value).includes(query)
  );
}
