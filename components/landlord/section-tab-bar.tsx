"use client";

import { Button } from "@/components/ui/button";

export type SectionTab<T extends string> = {
  id: T;
  label: string;
};

export function SectionTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SectionTab<T>[];
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          size="sm"
          variant={active === tab.id ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
