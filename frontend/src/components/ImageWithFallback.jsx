import { ImageOff } from "lucide-react";
import { useState } from "react";

const GRADIENTS = {
  "#f59e0b": "from-amber-200 via-amber-100 to-orange-50",
  "#0ea5e9": "from-sky-200 via-cyan-100 to-blue-50",
  "#10b981": "from-emerald-200 via-emerald-100 to-lime-50",
  "#ec4899": "from-pink-200 via-rose-100 to-amber-50",
  "#8b5cf6": "from-violet-200 via-purple-100 to-indigo-50",
};

export function ImageWithFallback({
  src,
  alt,
  className = "",
  fallbackColor = "#84cc16",
  fallbackLabel = "",
}) {
  const [failed, setFailed] = useState(!src);
  const gradient = GRADIENTS[fallbackColor] || "from-lime-200 via-lime-100 to-ink-100";

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br ${gradient} ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="h-6 w-6 text-ink-700/30" />
        {fallbackLabel && (
          <span className="mt-2 max-w-[80%] text-center text-xs font-bold uppercase tracking-[0.12em] text-ink-800/40">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
