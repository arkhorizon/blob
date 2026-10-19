function normalize(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function matchesEssaySearch(essay, rawQuery) {
  const query = normalize(rawQuery).trim();
  if (!query) return true;

  return [essay.title, essay.summary, essay.author, essay.translator, ...(essay.tags ?? [])].some(
    (value) => normalize(value).includes(query)
  );
}
