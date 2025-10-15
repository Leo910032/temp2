// app/elements/LandingPage Elements/GradientButton.jsx
"use client"
import { motion } from 'framer-motion';

/**
 * Animated gradient button component
 * Premium CTA button with hover effects and loading state
 */
export default function GradientButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  isLoading = false,
  className = ""
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`relative px-8 py-4 rounded-xl font-semibold text-white overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-themeGreen to-purple-600 animate-gradient-flow" />

      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-themeGreen to-purple-600 blur-xl opacity-0 group-hover:opacity-70 transition-opacity duration-500" />

      {/* Button content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Chargement...</span>
          </>
        ) : (
          children
        )}
      </span>
    </motion.button>
  );
}
