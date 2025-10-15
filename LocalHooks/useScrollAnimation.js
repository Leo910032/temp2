// LocalHooks/useScrollAnimation.js
import { useInView } from 'react-intersection-observer';

/**
 * Custom hook for scroll-triggered animations
 * Returns ref to attach to element and inView status
 * @param {Object} options - Intersection Observer options
 * @returns {Object} { ref, inView } - Ref for element and visibility status
 */
export function useScrollAnimation(options = {}) {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
    ...options,
  });

  return { ref, inView };
}
