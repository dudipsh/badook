export const BadookGradient = () => (
  <svg width="0" height="0" className="absolute" aria-hidden="true">
    <defs>
      <linearGradient id="badookGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4F46E5">
          <animate
            attributeName="stop-color"
            values="#4F46E5; #8B5CF6; #06B6D4; #4F46E5"
            dur="4s"
            repeatCount="indefinite"
          />
        </stop>
        <stop offset="50%" stopColor="#8B5CF6">
          <animate
            attributeName="stop-color"
            values="#8B5CF6; #06B6D4; #4F46E5; #8B5CF6"
            dur="4s"
            repeatCount="indefinite"
          />
        </stop>
        <stop offset="100%" stopColor="#06B6D4">
          <animate
            attributeName="stop-color"
            values="#06B6D4; #4F46E5; #8B5CF6; #06B6D4"
            dur="4s"
            repeatCount="indefinite"
          />
        </stop>
      </linearGradient>
    </defs>
  </svg>
);
