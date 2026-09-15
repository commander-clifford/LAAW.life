import type { ReactNode } from "react";

type CardProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

export function Card({ children, className = "" }: CardProps) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}
