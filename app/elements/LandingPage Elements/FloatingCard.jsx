// app/elements/LandingPage Elements/FloatingCard.jsx
"use client"
import { motion } from 'framer-motion';
import { useScrollAnimation } from '@/LocalHooks/useScrollAnimation';

/**
 * Floating card component with glassmorphism effect
 * Used for feature highlights on landing page
 */
export default function FloatingCard({ icon: Icon, title, description, delay = 0 }) {
  const { ref, inView } = useScrollAnimation();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="group relative backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-8 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-themeGreen/20"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-themeGreen/0 via-blue-500/0 to-purple-600/0 group-hover:from-themeGreen/10 group-hover:via-blue-500/10 group-hover:to-purple-600/10 transition-all duration-500 pointer-events-none" />

      <div className="relative z-10">
        {/* Icon with pulse effect */}
        <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-themeGreen to-blue-500 text-white shadow-lg group-hover:shadow-themeGreen/50 transition-shadow duration-300">
          <Icon className="text-2xl group-hover:scale-110 transition-transform duration-300" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-themeGreen transition-colors duration-300">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-white/70 leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
