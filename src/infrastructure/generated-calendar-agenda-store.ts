import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { CalendarAgenda } from "@/src/application/ports";

const agendaFile = resolve(process.cwd(), ".calendar-data/agendas.json");

let agendaIndexRequest: Promise<Record<string, CalendarAgenda>> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readAgendaIndex(): Promise<Record<string, CalendarAgenda>> {
  const contents = await readFile(agendaFile, "utf8");
  const parsed: unknown = JSON.parse(contents);

  if (!isRecord(parsed)) {
    throw new Error("Generated calendar agenda data is invalid");
  }

  return parsed as Record<string, CalendarAgenda>;
}

export async function getGeneratedCalendarAgenda(
  locationId: string,
): Promise<CalendarAgenda> {
  agendaIndexRequest ??= readAgendaIndex();
  const agenda = (await agendaIndexRequest)[locationId];

  if (!agenda) {
    throw new Error(`Generated calendar agenda is missing ${locationId}`);
  }

  return agenda;
}
