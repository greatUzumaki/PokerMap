"use client";

import * as React from "react";
import { cn } from "../cn";

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  className?: string;
  formatValue?: (n: number) => string;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  className,
  formatValue,
}: RangeSliderProps) {
  const [lo, hi] = value;

  const fmt = formatValue ?? ((n: number) => n.toString());

  const handleLo = (next: number) => {
    onValueChange([Math.min(next, hi), hi]);
  };
  const handleHi = (next: number) => {
    onValueChange([lo, Math.max(next, lo)]);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{fmt(lo)}</span>
        <span>{fmt(hi)}</span>
      </div>
      <div className="grid gap-1">
        <input
          aria-label="Минимум"
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => handleLo(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-input accent-primary"
        />
        <input
          aria-label="Максимум"
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => handleHi(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-input accent-primary"
        />
      </div>
    </div>
  );
}
