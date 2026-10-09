import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

type CardProps = Readonly<{ borderless?: boolean } & (
  | (HTMLAttributes<HTMLDivElement> & { as?: "div" })
  | (ButtonHTMLAttributes<HTMLButtonElement> & { as: "button" })
)>;

export function Card(props: CardProps) {
  if (props.as === "button") {
    const { as: Element, borderless = false, className = "", ...attributes } = props;
    return <Element className={`card ${borderless ? "card-borderless" : ""} ${className}`.trim()} {...attributes} />;
  }
  const { as: Element = "div", borderless = false, className = "", ...attributes } = props;
  return <Element className={`card ${borderless ? "card-borderless" : ""} ${className}`.trim()} {...attributes} />;
}
