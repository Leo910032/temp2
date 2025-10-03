// app/[userId]/components/ProfileCarousel.jsx
"use client"

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { FaPlay, FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";

export default function ProfileCarousel({ items = [], style = 'modern' }) {
    // Filter out items without images FIRST (before any hooks)
    const validItems = items.filter(item => item.image);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [videoModalOpen, setVideoModalOpen] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState('');
    const carouselRef = useRef(null);

    // ✅ ALL HOOKS MUST BE BEFORE ANY RETURN - Auto-scroll carousel to center current item
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
        if (!carouselRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - carouselRef.current.offsetLeft);
        setScrollLeft(carouselRef.current.scrollLeft);
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !carouselRef.current) return;
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

    // Open video modal
    const openVideoModal = (videoUrl) => {
        setCurrentVideoUrl(videoUrl);
        setVideoModalOpen(true);
    };

    // Close video modal
    const closeVideoModal = () => {
        setVideoModalOpen(false);
        setCurrentVideoUrl('');
    };

    // Early return AFTER ALL hooks
    if (!validItems || validItems.length === 0) {
        return null;
    }

    return (
        <div className="w-full my-8 px-4">
            {/* Video Modal */}
            {videoModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
                    onClick={closeVideoModal}
                >
                    <div
                        className="relative w-full max-w-4xl bg-black rounded-lg overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={closeVideoModal}
                            className="absolute top-4 right-4 z-10 bg-white bg-opacity-90 rounded-full p-2 hover:bg-opacity-100 transition-all"
                            aria-label="Close video"
                        >
                            <FaTimes className="text-gray-800 text-xl" />
                        </button>

                        {/* Video iframe */}
                        <div className="relative w-full pt-[56.25%]">
                            <iframe
                                className="absolute inset-0 w-full h-full"
                                src={currentVideoUrl}
                                title="Video player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Outer border container */}
            <div className="max-w-6xl mx-auto border-2 border-gray-300 rounded-3xl bg-gradient-to-br from-gray-50 to-white shadow-lg p-8">
                <div className={`relative ${validItems.length === 1 ? 'flex justify-center' : ''}`}>
                    {/* Navigation Arrows - Only show on desktop for multi-item carousels */}
                    {validItems.length > 1 && (
                    <>
                        <button
                            onClick={prevSlide}
                            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white shadow-xl rounded-full p-3 hover:bg-gray-50 transition-all hover:scale-110 active:scale-95"
                            aria-label="Previous slide"
                        >
                            <FaChevronLeft className="text-gray-700 text-lg" />
                        </button>
                        <button
                            onClick={nextSlide}
                            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white shadow-xl rounded-full p-3 hover:bg-gray-50 transition-all hover:scale-110 active:scale-95"
                            aria-label="Next slide"
                        >
                            <FaChevronRight className="text-gray-700 text-lg" />
                        </button>
                    </>
                )}

                {/* Carousel Track */}
                <div
                    ref={carouselRef}
                    className="flex gap-6 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing py-4 px-2"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    {validItems.map((item, index) => (
                        <CarouselCard
                            key={item.id}
                            item={item}
                            isActive={index === currentIndex}
                            style={style}
                            onClick={() => goToSlide(index)}
                            onVideoClick={openVideoModal}
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
                                        ? 'w-8 h-2 bg-blue-600 rounded-full'
                                        : 'w-2 h-2 bg-gray-400 rounded-full hover:bg-gray-600'
                                }`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}

// Individual Carousel Card Component
function CarouselCard({ item, isActive, style, onClick, onVideoClick }) {
    const getCardStyles = () => {
        const baseStyles = "flex-shrink-0 bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 cursor-pointer select-none border-4";

        switch (style) {
            case 'modern':
                return `${baseStyles} ${isActive ? 'md:w-80 w-72 scale-105 shadow-2xl border-blue-500' : 'md:w-72 w-64 scale-95 opacity-70 border-gray-400'}`;
            case 'minimal':
                return `${baseStyles} ${isActive ? 'md:w-80 w-72 shadow-2xl border-gray-500' : 'md:w-72 w-64 opacity-60 border-gray-400'}`;
            case 'bold':
                return `${baseStyles} ${isActive ? 'md:w-80 w-72 scale-110 shadow-2xl ring-4 ring-blue-500 border-blue-700' : 'md:w-72 w-64 scale-90 opacity-50 border-gray-500'}`;
            default:
                return `${baseStyles} ${isActive ? 'md:w-80 w-72 border-gray-500' : 'md:w-72 w-64 border-gray-400'}`;
        }
    };

    const handleCardClick = () => {
        // If item has a link, open it
        if (item.link) {
            window.open(item.link, '_blank', 'noopener,noreferrer');
        } else {
            onClick();
        }
    };

    const handlePlayClick = (e) => {
        e.stopPropagation(); // Prevent card click
        if (item.videoUrl) {
            // Convert YouTube URLs to embed format
            let embedUrl = item.videoUrl;
            const youtubeMatch = item.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
            if (youtubeMatch) {
                embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
            }
            onVideoClick(embedUrl);
        }
    };

    return (
        <div
            className={getCardStyles()}
            onClick={handleCardClick}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleCardClick();
                }
            }}
        >
            {/* Hero Image */}
            <div className="relative h-48 bg-gradient-to-br from-blue-400 to-purple-500">
                {item.image && (
                    <Image
                        src={item.image}
                        alt={item.title || 'Carousel item'}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="(max-width: 768px) 288px, 320px"
                        priority={isActive}
                    />
                )}

                {/* Play Icon for Video */}
                {item.videoUrl && (
                    <button
                        onClick={handlePlayClick}
                        className="absolute top-3 left-3 bg-white bg-opacity-95 rounded-full p-2.5 shadow-md hover:bg-opacity-100 hover:scale-110 transition-all z-10"
                        aria-label="Play video"
                    >
                        <FaPlay className="text-blue-600 text-sm" />
                    </button>
                )}

                {/* Link indicator */}
                {item.link && (
                    <div className="absolute top-3 right-3 bg-white bg-opacity-95 rounded-full p-2 shadow-md">
                        <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
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
