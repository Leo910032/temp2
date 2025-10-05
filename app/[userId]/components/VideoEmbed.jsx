// app/[userId]/components/VideoEmbed.jsx
"use client"

import React from 'react';

export default function VideoEmbed({ items }) {
    // Get the first video (since we only allow 1 video embed)
    const video = items && items.length > 0 ? items[0] : null;

    if (!video || !video.url) {
        return null;
    }

    // Extract video ID from various URL formats
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

    // Generate embed URL
    const getEmbedUrl = () => {
        const videoId = extractVideoId(video.url, video.platform);
        if (!videoId) return null;

        if (video.platform === 'youtube') {
            return `https://www.youtube.com/embed/${videoId}`;
        } else if (video.platform === 'vimeo') {
            return `https://player.vimeo.com/video/${videoId}`;
        }

        return null;
    };

    const embedUrl = getEmbedUrl();

    if (!embedUrl) {
        console.error('VideoEmbed: Could not generate embed URL from:', video.url);
        return null;
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Optional title */}
            {video.title && (
                <h3 className="text-lg font-semibold mb-3 text-center">
                    {video.title}
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
                    title={video.title || 'Embedded Video'}
                ></iframe>
            </div>

            {/* Optional description */}
            {video.description && (
                <p className="text-sm text-gray-600 mt-3 text-center">
                    {video.description}
                </p>
            )}
        </div>
    );
}
