//app/dashboard/(dashboard pages)/settings/elements/SortableSocialElement.jsx - NEW FILE
"use client"
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SocialElement from './SocialElement';

export default function SortableSocialElement({ id, item, index }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <li 
            ref={setNodeRef} 
            style={style}
            className={isDragging ? 'z-50' : ''}
        >
            <SocialElement 
                item={item} 
                index={index}
                dragAttributes={attributes}
                dragListeners={listeners}
                isDragging={isDragging}
            />
        </li>
    );
}