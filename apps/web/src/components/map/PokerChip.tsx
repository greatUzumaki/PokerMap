import { memo } from "react";

interface PokerChipProps {
  size?: number;
  active?: boolean;
}

function PokerChipComponent({ size = 36, active = false }: PokerChipProps) {
  const id = active ? "pm-chip-active" : "pm-chip";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={active ? "drop-shadow-2xl" : "drop-shadow-lg"}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor="hsl(350 80% 58%)" />
          <stop offset="60%" stopColor="hsl(350 75% 45%)" />
          <stop offset="100%" stopColor="hsl(350 70% 32%)" />
        </radialGradient>
        <radialGradient id={`${id}-face`} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="hsl(0 0% 100%)" />
          <stop offset="100%" stopColor="hsl(0 0% 92%)" />
        </radialGradient>
      </defs>
      {/* outer ring */}
      <circle cx="20" cy="20" r="18" fill={`url(#${id}-body)`} stroke="hsl(0 0% 100%)" strokeWidth="1.5" />
      {/* edge dashes — poker chip notches (8 wedges, white) */}
      <g fill="hsl(0 0% 100%)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const cx = 20 + Math.cos(rad) * 16;
          const cy = 20 + Math.sin(rad) * 16;
          return (
            <rect
              key={deg}
              x={cx - 2.2}
              y={cy - 4}
              width="4.4"
              height="8"
              rx="1.4"
              transform={`rotate(${deg + 90} ${cx} ${cy})`}
            />
          );
        })}
      </g>
      {/* inner face */}
      <circle cx="20" cy="20" r="11" fill={`url(#${id}-face)`} stroke="hsl(350 70% 32%)" strokeWidth="1" />
      {/* spade / center mark */}
      <path
        d="M20 13.5c-2.6 2.3-5 4.6-5 6.6 0 1.7 1.3 3.1 3 3.1.8 0 1.5-.3 2-.8-.2 1.1-.7 2-1.4 2.6h2.8c-.7-.6-1.2-1.5-1.4-2.6.5.5 1.2.8 2 .8 1.7 0 3-1.4 3-3.1 0-2-2.4-4.3-5-6.6z"
        fill="hsl(350 70% 32%)"
      />
    </svg>
  );
}

export const PokerChip = memo(PokerChipComponent);
