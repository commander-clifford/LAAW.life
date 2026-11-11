import type { HTMLAttributes, ReactNode } from "react";

import { Card } from "@/src/components/card";

type DayCardShellProps = Readonly<HTMLAttributes<HTMLDivElement> & {
  heading: ReactNode;
}>;

export function DayCardShell({ heading, children, className = "", ...attributes }: DayCardShellProps) {
  return (
    <Card className={`day-card ${className}`.trim()} {...attributes}>
      <header className="day-card-heading">{heading}</header>
      {children}
    </Card>
  );
}
