// /components/StrictModeDroppable.jsx
"use client"

import { useEffect, useState } from "react";
import { Droppable } from "react-beautiful-dnd";

// This wrapper component is the official community-accepted solution for using
// react-beautiful-dnd with React 18+ Strict Mode.
export const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));

    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return <Droppable {...props}>{children}</Droppable>;
};