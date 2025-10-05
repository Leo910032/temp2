//app/[userId]/elements/CVButton.jsx

"use client"

import { FaDownload } from 'react-icons/fa';

export default function CVButton({ cvDocument, userData }) {
    if (!cvDocument || !cvDocument.url) {
        return null;
    }

    const handleDownload = () => {
        window.open(cvDocument.url, '_blank', 'noopener,noreferrer');
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const btnType = userData?.btnType || 0;
    const btnColor = userData?.btnColor || '#6366f1';
    const btnFontColor = userData?.btnFontColor || '#ffffff';
    const btnShadowColor = userData?.btnShadowColor || '#4f46e5';

    const getButtonClasses = () => {
        // ✅ CHANGE #1: Replaced 'w-full' with the responsive width classes
let classes = "flex items-center justify-center gap-3 p-4 mb-4 font-semibold transition-all duration-200 active:scale-95 cursor-pointer select-none md:w-[35rem] sm:w-[30rem] w-clamp";
        
        if (btnType >= 0 && btnType <= 2) {
            classes += " shadow-lg hover:shadow-xl transform hover:-translate-y-0.5";
            if (btnType === 1) classes += " rounded-lg";
            if (btnType === 2) classes += " rounded-3xl";
        } else if (btnType >= 3 && btnType <= 5) {
            classes += " border-2 bg-transparent hover:bg-opacity-10";
            if (btnType === 4) classes += " rounded-lg";
            if (btnType === 5) classes += " rounded-3xl";
        } else if (btnType >= 6 && btnType <= 8) {
            classes += " border-2 bg-white";
            if (btnType === 7) classes += " rounded-lg";
            if (btnType === 8) classes += " rounded-3xl";
        } else if (btnType >= 9 && btnType <= 11) {
            classes += " bg-white shadow-[0_15px_30px_5px_rgba(0,0,0,0.5)]";
            if (btnType === 10) classes += " rounded-lg";
            if (btnType === 11) classes += " rounded-3xl";
        } else {
            classes += " shadow-md hover:shadow-lg";
            if (btnType === 15) classes += " rounded-3xl";
            if (btnType === 17) classes += " rounded-l-3xl";
        }
        
        return classes;
    };

    const getButtonStyles = () => {
        const styles = {};
        
        if (btnType >= 0 && btnType <= 2) {
            styles.backgroundColor = btnColor;
            styles.color = btnFontColor;
            if (btnShadowColor) {
                styles.boxShadow = `0 4px 14px 0 ${btnShadowColor}40`;
            }
        } else if (btnType >= 3 && btnType <= 5) {
            styles.borderColor = btnColor;
            styles.color = btnColor;
            styles.backgroundColor = 'transparent';
        } else if (btnType >= 6 && btnType <= 8) {
            styles.borderColor = btnColor;
            styles.color = btnColor;
            styles.backgroundColor = '#ffffff';
            styles.filter = `drop-shadow(4px 4px 0px ${btnShadowColor})`;
        } else if (btnType >= 9 && btnType <= 11) {
            styles.color = btnColor;
            styles.backgroundColor = '#ffffff';
        } else {
            styles.backgroundColor = btnColor;
            styles.color = btnFontColor;
        }
        
        return styles;
    };

    return (
        <div
            className={getButtonClasses()}
            style={getButtonStyles()}
            onClick={handleDownload}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDownload();
                }
            }}
        >
            <FaDownload className="text-base" />
            {/* ✅ CHANGE #2: Removed the extra inner div. The span can be a direct child. */}
            <span className="font-semibold">
                {cvDocument.displayTitle || 'Download CV'}
            </span>
        </div>
    );
}