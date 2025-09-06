// app/dashboard/(dashboard pages)/appearance/elements/Button.jsx - SERVER-SIDE VERSION
"use client"

export default function Button({ 
    modifierClass, 
    modifierStyles, 
    type, 
    onUpdate, 
    disabled = false 
}) {
    const handleClick = () => {
        if (disabled || !onUpdate) return;
        onUpdate(type || 0);
    };
    
    return (
        <div 
            onClick={handleClick}
            className={`${modifierClass} ${
                disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer hover:scale-105 active:scale-95'
            } min-w-[30%] h-10 flex-1 transition-all duration-200`}
            style={modifierStyles}
        ></div>
    );
}