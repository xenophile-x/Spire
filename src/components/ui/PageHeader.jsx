import React from "react";

export default function PageHeader({
  title,
  subtitle,
  action,
  icon,
  children,
  className = "",
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 mb-6 sm:mb-8 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div className="shrink-0 hidden sm:flex">{icon}</div>}
        <div className="min-w-0">
          <h1 className="font-bold tracking-tight text-white leading-none truncate text-[clamp(1.35rem,2.5vw,1.875rem)]">
            {title}
          </h1>
          {subtitle !== undefined && subtitle !== null && subtitle !== "" && (
            <p className="font-medium text-white/60 truncate text-xs mt-0.5">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-1">{children}</div>}
        </div>
      </div>
      {action && (
        <div className="shrink-0 flex items-center gap-2">{action}</div>
      )}
    </div>
  );
}
