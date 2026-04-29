import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = display;
    const end = value;
    if (start === end) return;
    const dur = 400;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      className="tabular-nums"
    >
      {display}
    </motion.span>
  );
}
