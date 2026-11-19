import type { ReactNode } from "react";

type PlannerSpreadProps = {
  as?: "div" | "section";
  className: string;
  children: ReactNode;
};

/** Shared two-page canvas used by the DAY, MONTH, and COVER views. */
export default function PlannerSpread({
  as: Element = "div",
  className,
  children
}: PlannerSpreadProps) {
  return <Element className={`planner-spread ${className}`}>{children}</Element>;
}
