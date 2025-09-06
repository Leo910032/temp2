//app/dashboard/general components/SortableItem.jsx
"use client"
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableItem(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.id });

  const style = {
    // Apply the transform for smooth movement
    transform: CSS.Transform.toString(transform),
    transition,
    // Make the original item invisible while it's being dragged via the overlay
    opacity: isDragging ? 0.3 : 1,
  };

  // Clone the child element (Normal or Special) and inject the required props
  return React.cloneElement(props.children, {
    itemRef: setNodeRef,
    style: style,
    attributes: attributes,
    listeners: listeners
  });
}