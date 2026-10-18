export function formatCalendarFreshness(
  generatedAt: string,
  now: number,
): string {
  const generatedAtMilliseconds = Date.parse(generatedAt);
  const ageMilliseconds = now - generatedAtMilliseconds;
  if (!Number.isFinite(generatedAtMilliseconds) || ageMilliseconds < 0) {
    return "Update time unavailable";
  }

  const ageMinutes = Math.floor(ageMilliseconds / 60_000);
  if (ageMinutes < 1) return "Updated just now";
  if (ageMinutes < 60) {
    return `Updated ${ageMinutes} ${ageMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) {
    return `Updated ${ageHours} ${ageHours === 1 ? "hour" : "hours"} ago`;
  }

  const ageDays = Math.floor(ageHours / 24);
  return `Updated ${ageDays} ${ageDays === 1 ? "day" : "days"} ago`;
}
