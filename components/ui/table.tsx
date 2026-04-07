import * as React from "react";
import { cn } from "./utils";

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  bordered?: boolean;
}

export function Table({
  className,
  bordered = true,
  ...props
}: TableProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-auto",
        bordered ? "border bg-card" : "border-0 bg-transparent"
      )}
    >
      <table
        className={cn(
          "w-full caption-bottom text-sm",
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
      className="[&>tr]:border-b"
      {...props}
    />
  );
}

export function TableBody(
  props: React.HTMLAttributes<HTMLTableSectionElement>
) {
  return <tbody className="[&>tr:last-child]:border-0" {...props} />;
}

export function TableRow(
  props: React.HTMLAttributes<HTMLTableRowElement>
) {
  return (
    <tr
      className="border-b transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted"
      {...props}
    />
  );
}

export function TableHead(
  props: React.ThHTMLAttributes<HTMLTableCellElement>
) {
  return (
    <th
      className="h-10 px-4 text-left align-middle text-[0.78rem] font-medium text-muted-foreground"
      {...props}
    />
  );
}

export function TableCell(
  props: React.TdHTMLAttributes<HTMLTableCellElement>
) {
  return (
    <td
      className="p-4 align-middle text-sm text-muted-foreground"
      {...props}
    />
  );
}

export function TableCaption(
  props: React.HTMLAttributes<HTMLTableCaptionElement>
) {
  return (
    <caption
      className="mt-4 text-left text-xs text-muted-foreground"
      {...props}
    />
  );
}

