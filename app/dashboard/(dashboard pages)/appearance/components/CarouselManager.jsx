// app/dashboard/(dashboard pages)/appearance/components/CarouselManager.jsx
"use client"

import React, { useMemo } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useAppearance } from "../AppearanceContext";
import CarouselContainerCard from "../elements/CarouselContainerCard";
import { useRouter, useSearchParams } from "next/navigation";
import { LinksService } from "@/lib/services/serviceLinks/client/LinksService.js";

export default function CarouselManager() {
    const { t, isInitialized } = useTranslation();
    const { appearance, updateAppearance, isSaving } = useAppearance();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get highlight ID from URL hash (for navigation from links page)
    const highlightId = searchParams.get('highlight');

    // Get carousels array from appearance
    const carousels = appearance?.carousels || [];

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.appearance.carousel.title') || 'Content Carousels',
            description: t('dashboard.appearance.carousel.description') || 'Manage your carousel collections. Each carousel can showcase multiple items on your profile.',
            noCarousels: t('dashboard.appearance.carousel.no_carousels') || 'No carousels yet. Go to Links page to add a carousel link.',
        };
    }, [t, isInitialized]);

    // Update a carousel
    const handleUpdateCarousel = (carouselId, updatedData) => {
        const updatedCarousels = carousels.map(carousel =>
            carousel.id === carouselId ? { ...carousel, ...updatedData } : carousel
        );
        updateAppearance('carousels', updatedCarousels);
    };

    // Delete a carousel (also need to delete the corresponding link)
    const handleDeleteCarousel = async (carouselId) => {
        const updatedCarousels = carousels
            .filter(carousel => carousel.id !== carouselId)
            .map((carousel, index) => ({ ...carousel, order: index }));

        updateAppearance('carousels', updatedCarousels);

        try {
            const linksData = await LinksService.getLinks(true);
            const links = linksData?.links || [];
            const filteredLinks = links
                .filter(link => !(link.type === 2 && link.carouselId === carouselId))
                .map((link, index) => ({ ...link, order: index }));

            if (filteredLinks.length !== links.length) {
                await LinksService.saveLinks(filteredLinks);
            }
        } catch (error) {
            console.error('Error removing linked carousel from links:', error);
            toast.error('Failed to remove linked carousel link');
        }

        toast.success('Carousel deleted');
    };

    if (!isInitialized) {
        return (
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6 animate-pulse">
                <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 w-full bg-gray-200 rounded mb-6"></div>
                <div className="h-32 w-full bg-gray-200 rounded"></div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
            {/* Header */}
            <div className="mb-4">
                <h3 className="text-xl font-semibold">{translations.title}</h3>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-6">
                {translations.description}
            </p>

            {/* Carousels List */}
            {carousels.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500 mb-4">{translations.noCarousels}</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go to Links Page
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {carousels
                        .sort((a, b) => a.order - b.order)
                        .map((carousel) => (
                            <CarouselContainerCard
                                key={carousel.id}
                                carousel={carousel}
                                onUpdate={(updatedData) => handleUpdateCarousel(carousel.id, updatedData)}
                                onDelete={() => handleDeleteCarousel(carousel.id)}
                                disabled={isSaving}
                                highlightId={highlightId}
                            />
                        ))}
                </div>
            )}
        </div>
    );
}