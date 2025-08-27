//app/dashboard/(dashboard pages)/settings/components/mini components/SocialCard.jsx - FIXED VERSION
"use client"
import React, { useContext, useEffect, useState, useMemo, useRef } from 'react';
import { SocialContext } from '../SocialSetting';

// ✅ Use @dnd-kit instead of react-beautiful-dnd
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import SortableSocialElement from '../../elements/SortableSocialElement';
import SocialElement from '../../elements/SocialElement';

const SocialCard = ({ array }) => {
    const { setSocialsArray } = useContext(SocialContext);
    const [items, setItems] = useState([]);
    const [activeItem, setActiveItem] = useState(null);
    const lastArrayRef = useRef(null);

    // ✅ FIXED: Move sensors to component level (not inside useMemo)
    const pointerSensor = useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8, // Start drag after moving 8px
        },
    });
    
    const keyboardSensor = useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
    });
    
    const sensors = useSensors(pointerSensor, keyboardSensor);

    // ✅ OPTIMIZED: Only update items if array actually changed
    useEffect(() => {
        const arrayString = JSON.stringify(array || []);
        
        // Skip update if array hasn't actually changed
        if (arrayString === lastArrayRef.current) {
            console.log('🔄 SocialCard: Array unchanged, skipping update');
            return;
        }
        
        console.log('🔄 SocialCard: Updating items from array:', array?.length || 0, 'items');
        setItems(array || []);
        lastArrayRef.current = arrayString;
    }, [array]);

    function handleDragStart(event) {
        const { active } = event;
        console.log('🎯 Drag started for item:', active.id);
        
        // Find the full item object from the ID
        const draggedItem = items.find(item => item.id === active.id);
        setActiveItem(draggedItem || null);
    }

    function handleDragEnd(event) {
        const { active, over } = event;
        console.log('🎯 Drag ended:', { activeId: active.id, overId: over?.id });
        
        setActiveItem(null); // Clear the active item

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex(item => item.id === active.id);
            const newIndex = items.findIndex(item => item.id === over.id);
            
            console.log('🔄 Moving item from index', oldIndex, 'to', newIndex);

            // Use arrayMove utility for clean reordering
            const newItems = arrayMove(items, oldIndex, newIndex);
            
            console.log('📋 New order:', newItems.map(item => `${item.id}-${item.type}`));
            
            // Update local state immediately for smooth UX
            setItems(newItems);
            
            // Update the tracking reference
            lastArrayRef.current = JSON.stringify(newItems);
            
            // Update parent state
            setSocialsArray(newItems);
        }
    }

    // ✅ OPTIMIZED: Memoized item IDs for SortableContext
    const itemIds = useMemo(() => items.map(item => item.id), [items]);

    // ✅ REDUCED: Less verbose logging
    console.log('🎨 SocialCard rendering with', items.length, 'items');

    // ✅ EARLY RETURN: Don't render if no items
    if (items.length === 0) {
        return <div className="pl-4 text-sm text-gray-500 py-4">No social icons added yet</div>;
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={itemIds}
                strategy={verticalListSortingStrategy}
            >
                <ul className='pl-4 grid gap-1'>
                    {items.map((item, index) => (
                        <SortableSocialElement 
                            key={item.id} 
                            id={item.id}
                            item={item}
                            index={index}
                        />
                    ))}
                </ul>
            </SortableContext>

            {/* Drag overlay shows the dragged item */}
            <DragOverlay>
                {activeItem && (
                    <SocialElement 
                        item={activeItem} 
                        index={-1} // Use -1 to indicate this is an overlay
                        isOverlay={true}
                    />
                )}
            </DragOverlay>
        </DndContext>
    );
};

// ✅ OPTIMIZED: Memoize the component to prevent unnecessary renders
export default React.memo(SocialCard);