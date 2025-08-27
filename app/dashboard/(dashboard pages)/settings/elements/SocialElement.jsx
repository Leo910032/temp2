//app/dashboard/(dashboard pages)/settings/elements/SocialElement.jsx - UPDATED FOR @dnd-kit
"use client"
import { SocialsList } from "@/lib/SocialsList";
import Image from "next/image";
import { useContext, useState } from "react";
import { SocialContext } from "../components/SocialSetting";

export default function SocialElement({ 
    item, 
    index, 
    dragAttributes, 
    dragListeners, 
    isDragging = false,
    isOverlay = false 
}) {
    const { setSettingIconModalOpen, setSocialsArray } = useContext(SocialContext);
    const [checkboxChecked, setCheckboxChecked] = useState(item.active);

    const handleCheckboxChange = (event) => {
        const checkedStatus = event.target.checked;
        console.log('🔄 Toggling social status:', item.id, checkedStatus);
        
        setSocialsArray((previousItems) =>
            previousItems.map(
                pItem => pItem.id === item.id ? { ...pItem, active: checkedStatus } : pItem
            )
        );
        setCheckboxChecked(checkedStatus);
    };

    const handleEdit = () => {
        console.log('✏️ Editing social item:', item);
        setSettingIconModalOpen({
            status: true,
            type: item.type,
            operation: 1,
            value: item.value,
        });
    }

    // ✅ IMPROVED: Better styling for different states
    const containerClasses = `
        flex items-center gap-3 bg-white rounded-lg transition-all duration-200
        ${isDragging ? 'shadow-lg rotate-2 scale-105' : 'shadow-sm'}
        ${isOverlay ? 'border-2 border-blue-300 bg-blue-50' : ''}
    `;

    return (
        <div 
            className={containerClasses}
            style={{ 
                boxShadow: isDragging ? '0 10px 30px 5px rgba(0, 0, 0, 0.1)' : '0 5px 25px 1px rgba(0, 0, 0, .05)' 
            }}
        >
            {/* ✅ FIXED: Drag handle with proper touch support */}
            <div 
                className="select-none p-2 cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded-lg transition-colors duration-200"
                {...dragAttributes}
                {...dragListeners}
                style={{ 
                    touchAction: 'none', // Important for mobile drag
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
            >
                <Image 
                    src="https://linktree.sirv.com/Images/icons/elipsis.svg" 
                    className="select-none pointer-events-none" 
                    alt="drag handle" 
                    width={15} 
                    height={15} 
                />
            </div>
            
            {/* ✅ IMPROVED: Main content area */}
            <div 
                className="flex-1 flex items-center justify-between p-3 hover:bg-black hover:bg-opacity-5 cursor-pointer rounded-lg active:scale-95 active:opacity-60 transition-all duration-200" 
                onClick={handleEdit}
            >
                <div className="flex-1 flex items-center gap-3">
                    <Image 
                        src={SocialsList[item.type]?.icon || '/default-icon.svg'} 
                        alt={SocialsList[item.type]?.title || 'Social icon'} 
                        height={25} 
                        width={25} 
                    />
                    <span className="font-semibold sm:text-base text-sm">
                        {SocialsList[item.type]?.title || 'Unknown Social'}
                    </span>
                </div>
                <Image 
                    src="https://linktree.sirv.com/Images/icons/pen.svg" 
                    alt="edit" 
                    height={15} 
                    width={15} 
                />
            </div>
            
            {/* ✅ IMPROVED: Toggle switch */}
            <div className="scale-[0.8] p-1">
                <label className="cursor-pointer relative flex justify-between items-center group p-2 text-xl">
                    <input 
                        type="checkbox" 
                        onChange={handleCheckboxChange} 
                        checked={checkboxChecked} 
                        className="absolute left-1/2 -translate-x-1/2 w-full h-full peer appearance-none rounded-md" 
                    />
                    <span className="cursor-pointer w-9 h-6 flex items-center flex-shrink-0 ml-4 p-1 bg-gray-400 rounded-full duration-300 ease-in-out peer-checked:bg-green-700 after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-md after:duration-300 peer-checked:after:translate-x-3 group-hover:after:translate-x-[2px]"></span>
                </label>
            </div>
        </div>
    );
}