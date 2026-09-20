import { mkdir, rename, writeFile } from "node:fs/promises";

import type { CalendarAgenda } from "@/src/application/ports";
import { laawLifeTenant } from "@/src/config/laaw-life";
import { googleCalendarAgendaProvider } from "@/src/infrastructure/google-calendar-agenda-provider";

const outputDirectory = new URL("../.calendar-data/", import.meta.url);
const outputFile = new URL("agendas.json", outputDirectory);
const temporaryOutputFile = new URL("agendas.json.tmp", outputDirectory);
const publicOutputDirectory = new URL("../public/calendar-data/", import.meta.url);
const publicOutputFile = new URL("agendas.json", publicOutputDirectory);
const temporaryPublicOutputFile = new URL("agendas.json.tmp", publicOutputDirectory);

const agendaEntries = await Promise.all(
  laawLifeTenant.locations.map(async (location) => {
    const agenda = await googleCalendarAgendaProvider.getAgenda(
      location.calendar,
    );

    if (agenda.failedSourceCount > 0) {
      throw new Error(
        `${location.displayName} is missing ${agenda.failedSourceCount} public calendar feeds`,
      );
    }

    return [location.id, agenda] as const;
  }),
);
const agendas = Object.fromEntries(agendaEntries) satisfies Record<
  string,
  CalendarAgenda
>;

const serializedAgendas = `${JSON.stringify(agendas)}\n`;
await mkdir(outputDirectory, { recursive: true });
await mkdir(publicOutputDirectory, { recursive: true });
await writeFile(temporaryOutputFile, serializedAgendas, "utf8");
await writeFile(temporaryPublicOutputFile, serializedAgendas, "utf8");
await rename(temporaryPublicOutputFile, publicOutputFile);
await rename(temporaryOutputFile, outputFile);

console.log(`Generated calendar agendas for ${agendaEntries.length} locations.`);
