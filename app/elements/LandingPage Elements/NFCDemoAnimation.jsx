// app/elements/LandingPage Elements/NFCDemoAnimation.jsx
"use client"
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { FaWifi, FaUser, FaCheck } from 'react-icons/fa6';

/**
 * Animated demo showing NFC tap → Digital profile flow
 * Loops continuously to demonstrate product value
 */
export default function NFCDemoAnimation() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-8 py-8">
      {/* NFC Card */}
      <motion.div
        animate={{
          scale: step === 0 ? 1.1 : 1,
          rotate: step === 0 ? [0, -5, 5, -5, 0] : 0,
        }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-themeGreen to-blue-500 shadow-xl flex items-center justify-center">
          <FaWifi className="text-white text-3xl" />
        </div>

        {/* Pulse rings when active */}
        {step === 0 && (
          <>
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl border-4 border-themeGreen"
            />
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1, delay: 0.5, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl border-4 border-themeGreen"
            />
          </>
        )}
      </motion.div>

      {/* Arrow */}
      <motion.div
        animate={{
          x: step === 1 ? [0, 10, 0] : 0,
          opacity: step === 1 ? 1 : 0.3,
        }}
        transition={{ duration: 0.5 }}
        className="text-themeGreen text-3xl font-bold"
      >
        →
      </motion.div>

      {/* Phone/Profile */}
      <motion.div
        animate={{
          scale: step === 1 ? 1.1 : 1,
          y: step === 1 ? [0, -10, 0] : 0,
        }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className="w-24 h-24 rounded-2xl bg-white shadow-xl flex items-center justify-center">
          <FaUser className="text-themeGreen text-3xl" />
        </div>

        {/* Loading indicator */}
        {step === 1 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-themeGreen flex items-center justify-center"
          >
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </motion.div>
        )}
      </motion.div>

      {/* Arrow */}
      <motion.div
        animate={{
          x: step === 2 ? [0, 10, 0] : 0,
          opacity: step === 2 ? 1 : 0.3,
        }}
        transition={{ duration: 0.5 }}
        className="text-themeGreen text-3xl font-bold"
      >
        →
      </motion.div>

      {/* Success Check */}
      <motion.div
        animate={{
          scale: step === 2 ? 1.1 : 1,
          rotate: step === 2 ? [0, 360] : 0,
        }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className={`w-24 h-24 rounded-2xl shadow-xl flex items-center justify-center transition-colors duration-500 ${
          step === 2 ? 'bg-themeGreen' : 'bg-gray-700'
        }`}>
          <FaCheck className="text-white text-3xl" />
        </div>

        {/* Success particles */}
        {step === 2 && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, x: 0, y: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  x: Math.cos((i * Math.PI) / 3) * 40,
                  y: Math.sin((i * Math.PI) / 3) * 40,
                }}
                transition={{ duration: 0.8 }}
                className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-themeGreen"
              />
            ))}
          </>
        )}
      </motion.div>
    </div>
  );
}
