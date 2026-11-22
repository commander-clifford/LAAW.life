// Site-only display copy for specific calendar occurrences; the generated feed stays untouched.
export function getCalendarEventCopy(locationId: string, dateKey: string, eventId: string) {
  if (
    locationId === "ivy-station" &&
    dateKey === "2026-11-21" &&
    eventId === "c_998g12g73ffcp0rb7k49tklt2o@group.calendar.google.com:75ilakpmp1nmpsgucl1pdpao4s@google.com:2026-11-21T20:00:00.000Z"
  ) {
    return {
      title: "Closed to the public for Lucky Guess Trivia Finals",
      note: "Congratulations LA Ale Jerks for second place trivia.",
    };
  }

  return null;
}
