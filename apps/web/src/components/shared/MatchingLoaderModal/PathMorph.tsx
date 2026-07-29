import { useMemo } from 'react';
import { interpolate } from 'flubber';

interface PathMorphProps {
  progress: number;
  fromPath: string;
  toPath: string;
  color: string;
  x: number;
  scale: number;
  opacity: number;
  scanProgress: number;
}

export const PathMorph = ({ progress, fromPath, toPath, color, x, scale, opacity, scanProgress }: PathMorphProps) => {
  const morpher = useMemo(() => interpolate(fromPath, toPath, { maxSegmentLength: 2 }), [fromPath, toPath]);
  const currentD = morpher(progress);

  const showScan = scanProgress >= 0 && scanProgress <= 1;
  const scanY = scanProgress * 396;
  const clipId = `scan-clip-${color.replace('#', '')}`;
  const gradId = `scan-grad-${color.replace('#', '')}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `translateX(${x}px) scale(${scale})`,
      }}
    >
      <svg
        viewBox="0 0 307.15 395.97"
        style={{ width: 300, height: 400, opacity, overflow: 'visible' }}
      >
        <path fill={color} d={currentD} style={{ mixBlendMode: 'multiply' }} />

        {showScan && (
          <>
            <defs>
              <clipPath id={clipId}>
                <path d={currentD} />
              </clipPath>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="30%" stopColor="white" stopOpacity="0.15" />
                <stop offset="45%" stopColor="white" stopOpacity="0.7" />
                <stop offset="50%" stopColor="white" stopOpacity="1" />
                <stop offset="55%" stopColor="white" stopOpacity="0.7" />
                <stop offset="70%" stopColor="white" stopOpacity="0.15" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <rect
                x="0"
                y={scanY - 50}
                width="307.15"
                height="100"
                fill={`url(#${gradId})`}
              />
            </g>
          </>
        )}
      </svg>
    </div>
  );
};
