//app/dashboard/general components/Drag.jsx
"use client"
import React, { useContext, useEffect, useState } from 'react';
import { ManageLinksContent } from './ManageLinks';

// --- NEW IMPORTS from dnd-kit ---
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

// --- NEW COMPONENT to handle individual items ---
import { SortableItem } from './SortableItem'; // We will create this file next
import Normal from '../general elements/draggables/Normal';
import Special from '../general elements/draggables/Special';
import CarouselItem from '../general elements/draggables/CarouselItem';

const DraggableList = ({ array }) => {
    const { setData } = useContext(ManageLinksContent);
    const [items, setItems] = useState([]);
    const [activeItem, setActiveItem] = useState(null); // To store the item being dragged for the overlay

    useEffect(() => {
        setItems(array || []); 
    }, [array]);

    // Setup sensors for different input methods (mouse, touch, keyboard)
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragStart(event) {
        const { active } = event;
        // Find the full item object from the ID and store it
        setActiveItem(items.find(item => item.id === active.id) || null);
    }

    function handleDragEnd(event) {
        const { active, over } = event;
        setActiveItem(null); // Clear the active item

        if (over && active.id !== over.id) {
            setItems((currentItems) => {
                const oldIndex = currentItems.findIndex(item => item.id === active.id);
                const newIndex = currentItems.findIndex(item => item.id === over.id);

                // Use the arrayMove utility from dnd-kit for a clean reorder
                const newItems = arrayMove(currentItems, oldIndex, newIndex);
                
                // Update the parent component's state
                setData(newItems);
                
                return newItems;
            });
        }
    }
    
    // This function renders the item for the DragOverlay (the "clone")
    function renderDragOverlay() {
        if (!activeItem) return null;
        if (activeItem.type === 0) {
            return <Normal item={activeItem} isOverlay={true} />;
        } else if (activeItem.type === 2) {
            return <CarouselItem item={activeItem} isOverlay={true} />;
        } else {
            return <Special item={activeItem} isOverlay={true} />;
        }
    }

    return (
        // 1. DndContext is the main wrapper
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {/* 2. SortableContext provides context to the sortable items */}
            <SortableContext
                items={items.map(item => item.id)} // It needs an array of unique IDs
                strategy={verticalListSortingStrategy}
            >
                <div className='flex flex-col gap-8'>
                    {items.map((item) => (
                        // 3. Render a SortableItem for each element
                        <SortableItem key={item.id} id={item.id}>
                            {item.type === 0 ? (
                                <Normal item={item} />
                            ) : item.type === 2 ? (
                                <CarouselItem item={item} />
                            ) : (
                                <Special item={item} />
                            )}
                        </SortableItem>
                    ))}
                </div>
            </SortableContext>

            {/* 4. DragOverlay renders the item being dragged, detached from the list */}
            <DragOverlay>
                {activeItem ? renderDragOverlay() : null}
            </DragOverlay>
        </DndContext>
    );
};

export default DraggableList;