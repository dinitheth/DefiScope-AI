import { useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

/**
 * Types out the given markdown text character-by-character.
 * Applies red/green coloring to negative/positive dollar/percent values.
 *
 * COLOR RULES:
 *   -$145.7M / -145,651,012.3 / -27.2% → red  (#EF4444)
 *   +$1.27B  / +629,734,567   / +3.5%  → green (#10B981)
 */

// Captures negative OR positive monetary/percentage values
// Negative: starts with - (includes $, digits, commas, decimals, K/M/B/T suffix, %)
// Positive: explicit + prefix OR just a $+digits that follows whitespace/non-digit
const NEG_RE =
  /(-\$[\d,]+(?:\.\d+)?[KMBT]?%?|-[\d,]+(?:\.\d+)?[KMBT]?%?)/g;
const POS_RE =
  /(\+\$[\d,]+(?:\.\d+)?[KMBT]?%?|\+[\d,]+(?:\.\d+)?[KMBT]?%?)/g;

function colorize(text: string): string {
  // Process negatives first, then positives
  let out = text.replace(
    NEG_RE,
    (m) => `<span class="ds-neg">${m}</span>`
  );
  out = out.replace(
    POS_RE,
    (m) => `<span class="ds-pos">${m}</span>`
  );
  return out;
}

export default function Typewriter({
  text,
  instant = false,
  onDone,
}: {
  text: string;
  instant?: boolean;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState(instant ? text : "");

  useEffect(() => {
    if (instant) {
      setShown(text);
      onDone?.();
      return;
    }
    setShown("");
    if (!text) return;

    const totalMs = Math.min(3500, Math.max(1200, text.length * 6));
    const tickMs = 16;
    const charsPerTick = Math.max(1, Math.ceil(text.length / (totalMs / tickMs)));

    let i = 0;
    const interval = setInterval(() => {
      i = Math.min(text.length, i + charsPerTick);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        onDone?.();
      }
    }, tickMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, instant]);

  // Inject color spans into the markdown source
  const colorized = useMemo(() => colorize(shown), [shown]);

  return (
    <div className="ds-md text-[14px] sm:text-[15px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {colorized}
      </ReactMarkdown>
    </div>
  );
}
