import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BADUK_PURE_PATHS, TARGET_DOC_PATH } from './logo-paths';
import { PathMorph } from './PathMorph';

const NODES = [
  {
    id: 0,
    color: '#2c1b4e',
    path: BADUK_PURE_PATHS.darkPurple,
    title: 'Invoice',
    opacity: 1.0,
    fanX: -60,
    fanY: 20,
    fanRotation: -8,
  },
  {
    id: 1,
    color: '#8960a7',
    path: BADUK_PURE_PATHS.purple,
    title: 'DC',
    opacity: 0.9,
    fanX: -10,
    fanY: 5,
    fanRotation: -3,
  },
  {
    id: 2,
    color: '#54c7e3',
    path: BADUK_PURE_PATHS.cyan,
    title: 'PO',
    opacity: 0.8,
    fanX: 40,
    fanY: -15,
    fanRotation: 3,
  },
];

const SCAN_START = 20;
const SCAN_STAGGER = 10;
const SCAN_DURATION = 30;

export const MatchingAnimation = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Timeline (200 frames @ 60fps ≈ 3.3s per loop):
  // 0-20: Hold fanned docs
  // 20-70: Scan effect (staggered per doc)
  // 70-110: Collapse into logo
  // 110-130: Hold logo
  // 130-170: Expand into fanned docs
  // 170-200: Hold fanned docs
  const collapseSpring = spring({ fps, frame: Math.max(0, frame - 70), config: { damping: 14 } });
  const expandSpring = spring({ fps, frame: Math.max(0, frame - 130), config: { damping: 14 } });
  const morphProgress = 1 - collapseSpring + expandSpring;

  const titleFade = Math.max(0, Math.min(1, (morphProgress - 0.7) / 0.3));

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: 'white', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        {NODES.map((node) => {
          const fanX = interpolate(morphProgress, [0, 1], [0, node.fanX]);
          const fanY = interpolate(morphProgress, [0, 1], [0, node.fanY]);
          const fanR = interpolate(morphProgress, [0, 1], [0, node.fanRotation]);
          const dynamicOpacity = node.opacity + (1 - node.opacity) * morphProgress;

          const nodeScanStart = SCAN_START + node.id * SCAN_STAGGER;
          const scanProgress = interpolate(
            frame,
            [nodeScanStart, nodeScanStart + SCAN_DURATION],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          const showScan = frame >= nodeScanStart && frame <= nodeScanStart + SCAN_DURATION;

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: node.id * 10,
              }}
            >
              <div
                style={{
                  transform: `translateX(${fanX}px) translateY(${fanY}px) rotate(${fanR}deg)`,
                }}
              >
                <PathMorph
                  progress={morphProgress}
                  fromPath={node.path}
                  toPath={TARGET_DOC_PATH}
                  color={node.color}
                  x={0}
                  scale={1.0}
                  opacity={dynamicOpacity}
                  scanProgress={showScan ? scanProgress : -1}
                />
              </div>

              {titleFade > 0.01 && (
                <div
                  style={{
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    pointerEvents: 'none',
                    transform: `translateX(${fanX}px) translateY(${fanY}px) rotate(${fanR}deg)`,
                    opacity: titleFade,
                    width: 200,
                    marginTop: -80,
                  }}
                >
                  <div
                    style={{ color: 'white', fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 12 }}
                  >
                    {node.title}
                  </div>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[0.6, 0.45, 0.7, 0.5, 0.35].map((w, i) => (
                      <div key={i}>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 9999,
                            width: `${w * 100}%`,
                            backgroundColor: 'rgba(255,255,255,0.3)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
