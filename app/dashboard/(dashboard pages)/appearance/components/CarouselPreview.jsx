// app/dashboard/(dashboard pages)/appearance/components/CarouselPreview.jsx
"use client"

import React, { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { FaPlay, FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function CarouselPreview({
    items,
    style = 'modern',
    backgroundType = 'Color',
    backgroundColor = '#FFFFFF',
    backgroundImage = '',
    backgroundVideo = ''
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const carouselRef = useRef(null);

    // Filter out items without images for preview
    const validItems = useMemo(() => (Array.isArray(items) ? items.filter(item => item.image) : []), [items]);

    // Auto-scroll carousel to center current item - MOVED BEFORE ANY RETURN
    useEffect(() => {
        if (carouselRef.current && validItems.length > 0) {
            const item = carouselRef.current.children[currentIndex];
            if (item) {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [currentIndex, validItems.length]);

    // Navigate to specific slide
    const goToSlide = (index) => {
        if (index >= 0 && index < validItems.length) {
            setCurrentIndex(index);
        }
    };

    // Previous slide
    const prevSlide = () => {
        setCurrentIndex((prev) => (prev === 0 ? validItems.length - 1 : prev - 1));
    };

    // Next slide
    const nextSlide = () => {
        setCurrentIndex((prev) => (prev === validItems.length - 1 ? 0 : prev + 1));
    };

    // Mouse drag handlers
    const handleMouseDown = (e) => {
        setIsDragging(true);
        setStartX(e.pageX - carouselRef.current.offsetLeft);
        setScrollLeft(carouselRef.current.scrollLeft);
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - carouselRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        carouselRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Touch handlers for mobile
    const handleTouchStart = (e) => {
        setStartX(e.touches[0].clientX);
    };

    const handleTouchMove = (e) => {
        if (!startX) return;
        const currentX = e.touches[0].clientX;
        const diff = startX - currentX;

        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
            setStartX(0);
        }
    };

    // Early return AFTER all hooks
    if (validItems.length === 0) {
        return (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <p className="text-gray-500">Add images to carousel items to see preview</p>
            </div>
        );
    }

    const renderBackgroundMedia = () => {
        if (backgroundType === 'Video' && backgroundVideo) {
            return (
                <video
                    src={backgroundVideo}
                    className="absolute inset-0 h-full w-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                />
            );
        }

        if (backgroundType === 'Image' && backgroundImage) {
            return (
                <Image
                    src={backgroundImage}
                    alt="Carousel background"
                    fill
                    style={{ objectFit: 'cover' }}
                />
            );
        }

        return null;
    };

    const backgroundStyle = useMemo(() => {
        if (backgroundType === 'Transparent') {
            return { background: 'transparent' };
        }

        if (backgroundType === 'Color' || !backgroundImage && !backgroundVideo) {
            return { background: backgroundColor || '#FFFFFF' };
        }
        return { backgroundColor: '#1f2937' };
    }, [backgroundType, backgroundColor, backgroundImage, backgroundVideo]);

    const useLightText = useMemo(() => {
        if (backgroundType === 'Transparent') {
            return false;
        }

        if (backgroundType === 'Color') {
            if (!backgroundColor || typeof backgroundColor !== 'string') {
                return false;
            }
            const hex = backgroundColor.replace('#', '');
            const normalizedHex = hex.length === 3
                ? hex.split('').map(char => char + char).join('')
                : hex.padEnd(6, 'f');
            const r = parseInt(normalizedHex.substring(0, 2), 16);
            const g = parseInt(normalizedHex.substring(2, 4), 16);
            const b = parseInt(normalizedHex.substring(4, 6), 16);
            const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
            return brightness < 150;
        }

        return Boolean(
            (backgroundType === 'Image' && backgroundImage) ||
            (backgroundType === 'Video' && backgroundVideo)
        );
    }, [backgroundType, backgroundColor, backgroundImage, backgroundVideo]);

    const headingTextClass = useLightText ? 'text-white' : 'text-gray-700';
    const subTextClass = useLightText ? 'text-white/80' : 'text-gray-500';
    const navButtonClass = useLightText
        ? 'bg-white/80 hover:bg-white text-gray-800'
        : 'bg-white shadow-lg hover:bg-gray-100';

    return (
        <div className="relative rounded-2xl p-6 overflow-hidden" style={backgroundStyle}>
            <div className="absolute inset-0 -z-10">
                {renderBackgroundMedia()}
                {(backgroundType === 'Image' && backgroundImage) || (backgroundType === 'Video' && backgroundVideo) ? (
                    <div className="absolute inset-0 bg-black/20" />
                ) : null}
            </div>
            <div className="text-center mb-4">
                <h4 className={`text-sm font-semibold ${headingTextClass}`}>Carousel Preview</h4>
                <p className={`text-xs ${subTextClass}`}>This is how your carousel will appear on your profile</p>
            </div>

            {/* Carousel Container */}
            <div className="relative max-w-5xl mx-auto">
                {/* Navigation Arrows */}
                {validItems.length > 1 && (
                    <>
                        <button
                            onClick={prevSlide}
                            className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full p-3 transition-colors ${navButtonClass}`}
                        >
                            <FaChevronLeft className={useLightText ? 'text-gray-900' : 'text-gray-700'} />
                        </button>
                        <button
                            onClick={nextSlide}
                            className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full p-3 transition-colors ${navButtonClass}`}
                        >
                            <FaChevronRight className={useLightText ? 'text-gray-900' : 'text-gray-700'} />
                        </button>
                    </>
                )}

                {/* Carousel Track */}
                <div
                    ref={carouselRef}
                    className="flex gap-6 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing px-12 py-4"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {validItems.map((item, index) => (
                        <CarouselCard
                            key={item.id}
                            item={item}
                            isActive={index === currentIndex}
                            style={style}
                            onClick={() => goToSlide(index)}
                        />
                    ))}
                </div>

                {/* Pagination Dots */}
                {validItems.length > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                        {validItems.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goToSlide(index)}
                                className={`transition-all ${
                                    index === currentIndex
                                        ? useLightText
                                            ? 'w-8 h-2 bg-white rounded-full'
                                            : 'w-8 h-2 bg-blue-600 rounded-full'
                                        : useLightText
                                            ? 'w-2 h-2 bg-white/70 rounded-full hover:bg-white'
                                            : 'w-2 h-2 bg-gray-400 rounded-full hover:bg-gray-600'
                                }`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Individual Carousel Card Component
function CarouselCard({ item, isActive, style, onClick }) {
    const getCardStyles = () => {
        const baseStyles = "flex-shrink-0 bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 cursor-pointer";

        switch (style) {
            case 'modern':
                return `${baseStyles} ${isActive ? 'w-80 scale-105' : 'w-72 scale-95 opacity-70'}`;
            case 'minimal':
                return `${baseStyles} ${isActive ? 'w-80' : 'w-72 opacity-60'}`;
            case 'bold':
                return `${baseStyles} ${isActive ? 'w-80 scale-110 shadow-2xl' : 'w-72 scale-90 opacity-50'}`;
            case 'showcase':
                return `${baseStyles} border-4 border-white/40 backdrop-blur ${isActive ? 'w-96 scale-105 shadow-2xl' : 'w-80 opacity-75'}`;
            case 'spotlight':
                return `${baseStyles} bg-gradient-to-b from-white via-white to-purple-100 ${isActive ? 'w-80 scale-105 shadow-xl' : 'w-72 opacity-70'}`;
            default:
                return `${baseStyles} ${isActive ? 'w-80' : 'w-72'}`;
        }
    };

    return (
        <div className={getCardStyles()} onClick={onClick}>
            {/* Hero Image */}
            <div className="relative h-48 bg-gradient-to-br from-blue-400 to-purple-500">
                {item.image && (
                    <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        style={{ objectFit: 'cover' }}
                    />
                )}

                {/* Play Icon for Video */}
                {item.videoUrl && (
                    <div className="absolute top-3 left-3 bg-white bg-opacity-95 rounded-full p-2 shadow-md">
                        <FaPlay className="text-blue-600 text-sm" />
                    </div>
                )}
            </div>

            {/* Card Content */}
            <div className="p-5 space-y-3">
                {/* Category Label */}
                {item.category && (
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full uppercase tracking-wide">
                        {item.category}
                    </span>
                )}

                {/* Title */}
                <h3 className="font-bold text-lg text-gray-900 line-clamp-2 leading-tight">
                    {item.title}
                </h3>

                {/* Description */}
                {item.description && (
                    <p className="text-sm text-gray-600 line-clamp-3">
                        {item.description}
                    </p>
                )}

                {/* Metadata */}
                {(item.author || item.readTime) && (
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                        {item.author && (
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {item.author.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-medium text-gray-700">{item.author}</span>
                            </div>
                        )}
                        {item.readTime && (
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {item.readTime}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
