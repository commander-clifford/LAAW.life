import { Fragment } from "react";

import type { CalendarProvider } from "@/src/application/ports";
import type { Tenant } from "@/src/domain/site";

type CalendarSiteProps = Readonly<{
  calendarProvider: CalendarProvider;
  tenant: Tenant;
}>;

export function CalendarSite({
  calendarProvider,
  tenant,
}: CalendarSiteProps) {
  return (
    <>
      <h1>{tenant.displayName}</h1>

      {tenant.locations.map((location) => {
        const embed = calendarProvider.getEmbed(location.calendar);

        return (
          <Fragment key={location.id}>
            <h2>{location.calendarHeading}</h2>
            <iframe
              src={embed.src}
              style={{ width: "80vw", height: "80vh" }}
              frameBorder="0"
              scrolling="no"
              title={location.calendarHeading}
            />
          </Fragment>
        );
      })}
    </>
  );
}
