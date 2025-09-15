/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/elements/AssestCardVideo.jsx
"use client"

import { FaCheck } from 'react-icons/fa6';

export default function AssestCardVideo({
    coverImg, src, type, text, onClick, disabled = false, isSelected = false
}) {
    return (
        <div className="flex-1 items-center flex flex-col group">
            <div 
                className={`h-[13rem] w-full relative border rounded-lg grid place-items-center overflow-hidden transition-all duration-200 ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group-hover:scale-105 active:scale-90'
                }`}
                onClick={disabled ? undefined : onClick}
            >
                <video 
                    className="h-full w-full object-cover"
                    autoPlay 
                    loop 
                    playsInline 
                    muted
                    poster={coverImg}
                >
                    <source src={src} type={type} />
                </video>

                {/* ✅ Add the selection indicator overlay */}
                {isSelected && (
                    <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-50 grid place-items-center z-10 text-white text-3xl">
                        <FaCheck />
                    </div>
                )}
            </div>
            <span className="py-3 text-sm font-medium">{text}</span>
        </div>
    );
}