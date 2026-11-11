import { describe, expect, it } from "vitest";

import {
  getCalendarSourceClassName,
  getCalendarSourceStyles,
} from "@/src/components/calendar-source-styles";

describe("calendar source color tokens", () => {
  it("keeps source classes stable while each location supplies its configured color", () => {
    const ivy = { sourceName: "Los Angeles Football Club", sourceColor: "#7986CB" };
    const hawthorne = { ...ivy, sourceColor: "#616161" };
    const ivyStyles = getCalendarSourceStyles([ivy, ivy], "ivy-station");
    const hawthorneStyles = getCalendarSourceStyles([hawthorne], "hawthorne");

    expect(getCalendarSourceClassName(ivy)).toBe("calendar-source--los-angeles-football-club");
    expect(getCalendarSourceClassName(hawthorne)).toBe(getCalendarSourceClassName(ivy));
    expect(ivyStyles.split("\n")).toHaveLength(1);
    expect(ivyStyles).toBe(".calendar-location--ivy-station .calendar-source--los-angeles-football-club { --calendar-source-color: #7986CB; }");
    expect(hawthorneStyles).toBe(".calendar-location--hawthorne .calendar-source--los-angeles-football-club { --calendar-source-color: #616161; }");
  });

  it("supports refreshed colors without permitting source names to inject CSS", () => {
    const source = { sourceName: 'Café </style><script>alert(1)</script>', sourceColor: "#aabbcc" };
    const className = getCalendarSourceClassName(source);

    expect(className).toMatch(/^calendar-source--cafe-[a-z0-9-]+$/);
    expect(className).not.toContain("aabbcc");
    expect(getCalendarSourceClassName({ ...source, sourceColor: "#123456" })).toBe(className);
    expect(getCalendarSourceStyles([source], "ivy-station")).toBe(`.calendar-location--ivy-station .${className} { --calendar-source-color: #AABBCC; }`);
    expect(getCalendarSourceStyles([source], "ivy-station")).not.toMatch(/[<>]/);
  });

  it("does not create color tokens for missing or invalid source colors", () => {
    for (const sourceColor of [undefined, "", "red", "#fff", "#000000; color:red"])
      expect(getCalendarSourceStyles([{ sourceName: "Unknown calendar", sourceColor }], "ivy-station")).toBe("");
  });
});
