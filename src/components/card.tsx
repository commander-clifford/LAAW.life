import type { HTMLAttributes } from "react";

type CardProps = Readonly<HTMLAttributes<HTMLDivElement>>;

export function Card({ className = "", ...props }: CardProps) {
  return <div className={`card ${className}`.trim()} {...props} />;
}
