import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";

interface CarouselItem {
  key: string;
  label: string;
  node: React.ReactNode;
}

/**
 * Animated card carousel for AI tool results.
 * - Single item: slides in from right, no controls.
 * - Multiple items: auto-advances every 7s with smooth slide transition.
 *   User can pause/navigate manually.
 * Each card enters with a spring animation.
 */
export default function ToolCarousel({ items }: { items: CarouselItem[] }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-advance
  useEffect(() => {
    if (items.length <= 1 || paused) return;
    intervalRef.current = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % items.length);
    }, 7000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [items.length, paused]);

  if (items.length === 0) return null;

  // Single item — just slide in
  if (items.length === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 48, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {items[0].node}
      </motion.div>
    );
  }

  const go = (d: 1 | -1) => {
    setDirection(d);
    setIndex((i) => (i + d + items.length) % items.length);
    setHasInteracted(true);
    // Pause for 12s after manual interaction
    setPaused(true);
    setTimeout(() => setPaused(false), 12_000);
  };

  const jumpTo = (i: number) => {
    setDirection(i > index ? 1 : -1);
    setIndex(i);
    setHasInteracted(true);
    setPaused(true);
    setTimeout(() => setPaused(false), 12_000);
  };

  const current = items[index];

  // Progress bar for auto-advance
  const progressKey = `${index}-${paused}`;

  return (
    <div className="relative">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        {/* Dots + counter */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === index ? 20 : 6,
                  height: 4,
                  background: i === index ? "#3B82F6" : "#232323",
                }}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          <span
            className="text-[10px] uppercase tracking-wider font-medium"
            style={{ color: "#6B7280" }}
          >
            {String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
          </span>
        </div>

        {/* Label + controls */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] font-medium mr-1 hidden sm:inline"
            style={{ color: "#8B92A5" }}
          >
            {current.label}
          </span>

          {/* Play/Pause */}
          <button
            onClick={() => {
              setPaused((p) => !p);
              setHasInteracted(true);
            }}
            className="h-6 w-6 rounded-md flex items-center justify-center transition-colors"
            style={{ color: "#8B92A5" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1C1C1C";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#8B92A5";
            }}
            aria-label={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>

          <button
            onClick={() => go(-1)}
            className="h-6 w-6 rounded-md flex items-center justify-center transition-colors"
            style={{ color: "#8B92A5" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1C1C1C";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#8B92A5";
            }}
            aria-label="Previous"
          >
            <ChevronLeft size={14} />
          </button>

          <button
            onClick={() => go(1)}
            className="h-6 w-6 rounded-md flex items-center justify-center transition-colors"
            style={{ color: "#8B92A5" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1C1C1C";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#8B92A5";
            }}
            aria-label="Next"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Auto-advance progress bar */}
      {!paused && (
        <div
          className="h-0.5 rounded-full mb-2 overflow-hidden"
          style={{ background: "#1C1C1C" }}
        >
          <motion.div
            key={progressKey}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 7, ease: "linear" }}
            className="h-full rounded-full"
            style={{ background: "#3B82F660" }}
          />
        </div>
      )}

      {/* Slide viewport */}
      <div className="relative overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={current.key}
            custom={direction}
            initial={{ opacity: 0, x: direction * 60, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -direction * 60, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {current.node}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Keyboard hint — shown only until user interacts */}
      {!hasInteracted && items.length > 1 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-center text-[10px] mt-2"
          style={{ color: "#4B5563" }}
        >
          Auto-advancing · click arrows to navigate
        </motion.p>
      )}
    </div>
  );
}
