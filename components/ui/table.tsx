import * as React from "react";
import { cn } from "./utils";

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  bordered?: boolean;
}

const tableCellBorder =
  "border-b border-r border-slate-200 last:border-r-0";

export function Table({
  className,
  bordered = true,
  ...props
}: TableProps) {
  return (
    <div
      className={cn(
        "relative mt-[10px] w-full overflow-auto",
        bordered ? "bg-card" : "bg-transparent"
      )}
    >
      <table
        className={cn(
          "w-full caption-bottom border-collapse text-sm",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader(
  props: React.HTMLAttributes<HTMLTableSectionElement>
) {
  return (
    <thead
      className="[&>tr:hover]:bg-transparent"
      {...props}
    />
  );
}

export function TableBody(
  props: React.HTMLAttributes<HTMLTableSectionElement>
) {
  return (
    <tbody
      className="[&>tr:last-child>td]:border-b-0 [&>tr:hover]:bg-muted/40 [&>tr]:transition-colors"
      {...props}
    />
  );
}

export function TableRow(
  props: React.HTMLAttributes<HTMLTableRowElement>
) {
  return (
    <tr
      className="data-[state=selected]:bg-muted"
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 bg-muted/40 px-3 text-center align-middle text-[0.78rem] font-medium text-muted-foreground select-none",
        tableCellBorder,
        className
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 text-center align-middle text-xs text-slate-700",
        tableCellBorder,
        "[&>div.flex]:justify-center [&>div.grid]:mx-auto",
        className
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn("mt-4 text-center text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}
