import type { HTMLAttributes } from "react";

type CardProps = Readonly<HTMLAttributes<HTMLDivElement> & { borderless?: boolean }>;

export function Card({ borderless = false, className = "", ...props }: CardProps) {
  return <div className={`card ${borderless ? "card-borderless" : ""} ${className}`.trim()} {...props} />;
}
