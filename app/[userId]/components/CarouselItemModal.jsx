"use client"

import React, { useMemo } from "react";
import Image from "next/image";
import { FaTimes } from "react-icons/fa";

const FALLBACK_MEDIA_HEIGHT = {
    mobile: "h-[60vh]",
    desktop: "md:h-[70vh]"
};

const getEmbeddedVideoUrl = (url = "") => {
    if (typeof url !== "string") return "";
    const trimmed = url.trim();
    if (!trimmed) return "";

    const youtubeMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (youtubeMatch) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
    }

    return "";
};

export default function CarouselItemModal({ item, isOpen, onClose }) {
    const mediaType = item?.mediaType;
    const mediaUrl = item?.mediaUrl;
    const legacyVideoUrl = mediaType !== "video" ? item?.videoUrl : "";
    const inlineEmbedUrl = useMemo(() => {
        if (mediaType !== "video") return "";
        return getEmbeddedVideoUrl(mediaUrl);
    }, [mediaType, mediaUrl]);
    const legacyEmbedUrl = useMemo(() => getEmbeddedVideoUrl(legacyVideoUrl), [legacyVideoUrl]);

    if (!isOpen || !item) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 py-8"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="relative w-full max-w-3xl md:max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="carousel-item-modal-title"
            >
                <button
                    type="button"
                    aria-label="Close"
                    className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                    onClick={onClose}
                >
                    <FaTimes className="text-lg" />
                </button>

                <div className={`relative w-full ${FALLBACK_MEDIA_HEIGHT.mobile} ${FALLBACK_MEDIA_HEIGHT.desktop} bg-black`}>
                    {mediaType === "video" && mediaUrl && !inlineEmbedUrl ? (
                        <video
                            src={mediaUrl}
                            className="absolute inset-0 h-full w-full object-contain bg-black"
                            controls
                            autoPlay
                            playsInline
                        />
                    ) : inlineEmbedUrl ? (
                        <iframe
                            className="absolute inset-0 h-full w-full"
                            src={inlineEmbedUrl}
                            title={item?.title || "Carousel video"}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : legacyEmbedUrl ? (
                        <iframe
                            className="absolute inset-0 h-full w-full"
                            src={legacyEmbedUrl}
                            title={item?.title || "Carousel video"}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : mediaUrl ? (
                        <Image
                            src={mediaUrl}
                            alt={item?.title || "Carousel item"}
                            fill
                            sizes="(max-width: 768px) 90vw, 800px"
                            className="object-contain"
                            priority
                        />
                    ) : null}
                </div>

                <div className="p-6 md:p-8 overflow-y-auto max-h-[45vh] md:max-h-[40vh]">
                    {item?.category && (
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full uppercase tracking-wide mb-4">
                            {item.category}
                        </span>
                    )}

                    {item?.title && (
                        <h3 id="carousel-item-modal-title" className="text-2xl font-bold text-gray-900">
                            {item.title}
                        </h3>
                    )}

                    {item?.description && (
                        <p className="mt-3 text-gray-600 leading-relaxed">
                            {item.description}
                        </p>
                    )}

                    {(item?.author || item?.readTime || item?.link) && (
                        <div className="mt-6 flex flex-col gap-4 text-sm text-gray-500">
                            {item?.author && (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                                        {item.author.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-gray-800 font-medium">{item.author}</p>
                                        <p>Author</p>
                                    </div>
                                </div>
                            )}
                            {item?.readTime && (
                                <p className="uppercase tracking-wide font-semibold text-gray-600">
                                    {item.readTime}
                                </p>
                            )}
                            {item?.link && (
                                <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700 transition"
                                >
                                    Visit Link
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
