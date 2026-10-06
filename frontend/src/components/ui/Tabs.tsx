import type { ReactNode } from "react";
import "./Tabs.css";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={["tabs", className].filter(Boolean).join(" ")}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          type="button"
          aria-selected={value === tab.value}
          className={["tabs__tab", value === tab.value && "is-active"].filter(Boolean).join(" ")}
          onClick={() => onChange(tab.value)}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
