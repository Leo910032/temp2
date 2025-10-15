// app/elements/LandingPage Elements/AnimatedStat.jsx
"use client"
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useScrollAnimation } from '@/LocalHooks/useScrollAnimation';

/**
 * Animated statistic counter component
 * Counts up from 0 to target value when scrolled into view
 */
export default function AnimatedStat({ value, suffix = "", label, delay = 0 }) {
  const { ref, inView } = useScrollAnimation();
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (inView) {
      const controls = animate(count, value, {
        duration: 2,
        delay,
        ease: "easeOut"
      });

      return controls.stop;
    }
  }, [inView, value, count, delay]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (latest) => {
      setDisplayValue(latest);
    });
    return unsubscribe;
  }, [rounded]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-themeGreen via-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
        {displayValue}{suffix}
      </div>
      <div className="text-sm md:text-base text-white/70 font-medium">
        {label}
      </div>
    </motion.div>
  );
}
