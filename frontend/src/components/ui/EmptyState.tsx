import type { ReactNode } from "react";
import { Tray } from "@phosphor-icons/react";
import "./EmptyState.css";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={["empty-state", className].filter(Boolean).join(" ")}>
      <div className="empty-state__icon">{icon ?? <Tray size={22} weight="duotone" />}</div>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
