// LocalHooks/useMousePosition.js
import { useState, useEffect } from 'react';

/**
 * Custom hook to track mouse position globally
 * Used for cursor-following effects and interactive animations
 * @returns {Object} { x, y } - Current mouse coordinates
 */
export function useMousePosition() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', updateMousePosition);

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, []);

  return mousePosition;
}
