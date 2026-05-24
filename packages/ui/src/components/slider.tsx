"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
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

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{fmt(lo)}</span>
        <span>{fmt(hi)}</span>
      </div>
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={step}
        value={[lo, hi]}
        onValueChange={(next) => {
          if (next.length === 2) onValueChange([next[0]!, next[1]!]);
        }}
        minStepsBetweenThumbs={1}
        className="relative flex h-5 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-input">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label="Минимум"
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
        />
        <SliderPrimitive.Thumb
          aria-label="Максимум"
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
        />
      </SliderPrimitive.Root>
    </div>
  );
}
