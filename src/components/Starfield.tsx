import { useEffect, useRef } from "react";

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let stars: { x: number; y: number; z: number; size: number; opacity: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const initStars = () => {
      const count = Math.min(180, Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 5000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        z: Math.random() * 2,
        size: Math.random() * 1.8 + 0.3,
        opacity: Math.random() * 0.6 + 0.1,
      }));
    };

    resize();
    initStars();

    let time = 0;
    const animate = () => {
      time += 0.003;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const isDark = document.documentElement.classList.contains("dark");
      const baseColor = isDark ? "180, 200, 255" : "60, 80, 160";

      for (const star of stars) {
        const twinkle = Math.sin(time * (1 + star.z) + star.x * 0.01) * 0.3 + 0.7;
        const alpha = star.opacity * twinkle;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor}, ${alpha})`;
        ctx.fill();

        // Subtle glow for larger stars
        if (star.size > 1.2) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${baseColor}, ${alpha * 0.08})`;
          ctx.fill();
        }

        // Slow drift
        star.y -= 0.02 * (1 + star.z);
        star.x += Math.sin(time + star.y * 0.005) * 0.05;
        if (star.y < -5) {
          star.y = h + 5;
          star.x = Math.random() * w;
        }
      }

      animId = requestAnimationFrame(animate);
    };

    animate();
    window.addEventListener("resize", () => { resize(); initStars(); });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}
