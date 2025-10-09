// app/[userId]/components/MediaDisplay.jsx
"use client"

import React from 'react';
import Image from 'next/image';

export default function MediaDisplay({ items }) {
    // Get the first media item (since we only allow 1 media embed per link)
    const mediaItem = items && items.length > 0 ? items[0] : null;

    // Return null if no media item or no URL
    if (!mediaItem || !mediaItem.url) {
        return null;
    }

    // Extract video ID from various URL formats (for video media type)
    const extractVideoId = (url, platform) => {
        if (!url) return null;

        try {
            if (platform === 'youtube') {
                // Handle youtube.com/watch?v=VIDEO_ID
                const watchMatch = url.match(/[?&]v=([^&]+)/);
                if (watchMatch) return watchMatch[1];

                // Handle youtu.be/VIDEO_ID
                const shortMatch = url.match(/youtu\.be\/([^?]+)/);
                if (shortMatch) return shortMatch[1];

                // Handle youtube.com/embed/VIDEO_ID
                const embedMatch = url.match(/youtube\.com\/embed\/([^?]+)/);
                if (embedMatch) return embedMatch[1];
            } else if (platform === 'vimeo') {
                // Handle vimeo.com/VIDEO_ID
                const match = url.match(/vimeo\.com\/(\d+)/);
                if (match) return match[1];
            }
        } catch (error) {
            console.error('Error extracting video ID:', error);
        }

        return null;
    };

    // Generate embed URL for videos
    const getEmbedUrl = () => {
        const videoId = extractVideoId(mediaItem.url, mediaItem.platform);
        if (!videoId) return null;

        if (mediaItem.platform === 'youtube') {
            return `https://www.youtube.com/embed/${videoId}`;
        } else if (mediaItem.platform === 'vimeo') {
            return `https://player.vimeo.com/video/${videoId}`;
        }

        return null;
    };

    // Determine media type (default to video for backward compatibility)
    const mediaType = mediaItem.mediaType || 'video';

    // Handle video display
    if (mediaType === 'video') {
        const embedUrl = getEmbedUrl();

        if (!embedUrl) {
            console.error('MediaDisplay: Could not generate embed URL from:', mediaItem.url);
            return null;
        }

        return (
            <div className="w-full max-w-2xl mx-auto">
                {/* Optional title */}
                {mediaItem.title && (
                    <h3 className="text-lg font-semibold mb-3 text-center">
                        {mediaItem.title}
                    </h3>
                )}

                {/* Video embed container with 16:9 aspect ratio */}
                <div className="relative w-full rounded-2xl overflow-hidden shadow-lg" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                        src={embedUrl}
                        className="absolute top-0 left-0 w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={mediaItem.title || 'Embedded Video'}
                    ></iframe>
                </div>

                {/* Optional description */}
                {mediaItem.description && (
                    <p className="text-sm text-gray-600 mt-3 text-center">
                        {mediaItem.description}
                    </p>
                )}
            </div>
        );
    }

    // Handle image display
    if (mediaType === 'image') {
        // Use imageUrl if available, otherwise fall back to url
        const imageUrl = mediaItem.imageUrl || mediaItem.url;

        if (!imageUrl) {
            return null;
        }

        // Determine if the image has a link
        const hasLink = mediaItem.link && mediaItem.link.trim() !== '';

        const imageContent = (
            <div className="w-full max-w-2xl mx-auto">
                {/* Optional title */}
                {mediaItem.title && (
                    <h3 className="text-lg font-semibold mb-3 text-center">
                        {mediaItem.title}
                    </h3>
                )}

                {/* Image container with 16:9 aspect ratio */}
                <div className="relative w-full rounded-2xl overflow-hidden shadow-lg" style={{ paddingBottom: '56.25%' }}>
                    <Image
                        src={imageUrl}
                        alt={mediaItem.title || 'Media item'}
                        fill
                        style={{ objectFit: 'cover' }}
                        className={hasLink ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}
                        sizes="(max-width: 768px) 100vw, 672px"
                        priority={false}
                    />
                </div>

                {/* Optional description */}
                {mediaItem.description && (
                    <p className="text-sm text-gray-600 mt-3 text-center">
                        {mediaItem.description}
                    </p>
                )}
            </div>
        );

        // Wrap in link if provided
        if (hasLink) {
            return (
                <a
                    href={mediaItem.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:scale-[1.02] transition-transform"
                >
                    {imageContent}
                </a>
            );
        }

        return imageContent;
    }

    // Fallback for unknown media types
    console.warn('MediaDisplay: Unknown media type:', mediaType);
    return null;
}
