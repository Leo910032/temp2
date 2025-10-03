"use client"

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useContext, useMemo, useState, useEffect } from 'react';
import { FaX, FaGear } from 'react-icons/fa6';
import { ManageLinksContent } from '../../general components/ManageLinks';
import { useTranslation } from '@/lib/translation/useTranslation';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';
import { useDebounce } from '@/LocalHooks/useDebounce';

// Carousel Item Component - Type 2
export default function CarouselItem({ item, itemRef, style, listeners, attributes, isOverlay = false }) {
    const { t, isInitialized } = useTranslation();
    const { setData } = useContext(ManageLinksContent);
    const { currentUser } = useDashboard();
    const [wantsToDelete, setWantsToDelete] = useState(false);
    const [carouselEnabled, setCarouselEnabled] = useState(false);
    const [isLoadingToggle, setIsLoadingToggle] = useState(true);
    const router = useRouter();
    const debouncedCarouselEnabled = useDebounce(carouselEnabled, 500);

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            carouselTitle: t('dashboard.links.item.carousel_title_default') || 'Content Carousel',
            carouselDescription: t('dashboard.links.item.carousel_description') || 'Display your content carousel here',
            customizeButton: t('dashboard.links.item.customize_carousel') || 'Customize',
            deleteTooltip: t('dashboard.links.item.delete_tooltip') || 'Delete',
            deleteHeader: t('dashboard.links.item.delete_header') || 'Delete this item?',
            deleteConfirmationQuestion: t('dashboard.links.item.delete_confirmation_question') || 'Are you sure you want to delete this?',
            cancelButton: t('dashboard.links.item.cancel_button') || 'Cancel',
            deleteButton: t('dashboard.links.item.delete_button') || 'Delete',
        };
    }, [t, isInitialized]);

    // Load carousel enabled state on mount
    useEffect(() => {
        const loadCarouselState = async () => {
            if (!currentUser) return;

            try {
                const appearance = await AppearanceService.getAppearanceData();
                setCarouselEnabled(appearance.carouselEnabled || false);
            } catch (error) {
                console.error('Error loading carousel state:', error);
            } finally {
                setIsLoadingToggle(false);
            }
        };

        loadCarouselState();
    }, [currentUser]);

    // Save carousel enabled state when toggled
    useEffect(() => {
        if (isLoadingToggle) return; // Don't save on initial load

        const saveCarouselState = async () => {
            try {
                await AppearanceService.updateCarouselEnabled(carouselEnabled);
            } catch (error) {
                console.error('Error saving carousel state:', error);
            }
        };

        saveCarouselState();
    }, [debouncedCarouselEnabled, isLoadingToggle]);

    const handleToggleCarousel = (event) => {
        setCarouselEnabled(event.target.checked);
    };

    const handleDelete = () => {
        setData(prevData => prevData.filter(i => i.id !== item.id));
    };

    const handleCustomize = () => {
        // Navigate to appearance page with carousel hash
        router.push('/dashboard/appearance#carousel');

        // After navigation, scroll to the carousel section
        setTimeout(() => {
            const carouselSection = document.getElementById('carousel');
            if (carouselSection) {
                carouselSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    };

    const containerClasses = `rounded-3xl border flex flex-col bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300 ${isOverlay ? 'shadow-lg' : ''}`;

    // Loading state while translations load
    if (!isInitialized) {
        return (
            <div ref={itemRef} style={style} className={`${containerClasses} h-[8rem] bg-gray-200 animate-pulse`}>
            </div>
        )
    }

    return (
        <div
            ref={itemRef}
            style={style}
            className={containerClasses}
        >
            <div className={`h-[8rem] items-center flex`}>
                {/* Drag handle */}
                <div
                    className='active:cursor-grabbing h-full px-2 grid place-items-center touch-none'
                    {...listeners}
                    {...attributes}
                >
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/drag.svg"}
                        alt='drag icon'
                        height={15}
                        width={15}
                    />
                </div>

                <div className='flex-1 flex flex-col px-3 gap-2'>
                    {/* Carousel Title with Icon */}
                    <div className='flex gap-3 items-center'>
                        <span className='font-semibold text-purple-700 flex items-center gap-2'>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                            </svg>
                            {translations.carouselTitle}
                        </span>
                    </div>

                    {/* Carousel Description */}
                    <div className='text-sm text-purple-600 opacity-80'>
                        Drag to position where your carousel will appear
                    </div>

                    {/* Customize Button */}
                    <button
                        onClick={handleCustomize}
                        className='flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm w-fit'
                    >
                        <FaGear className='text-xs' />
                        <span>{translations.customizeButton}</span>
                    </button>
                </div>

                {/* Toggle and Delete Buttons */}
                <div className='grid sm:pr-2 gap-2 place-items-center'>
                    {/* Toggle Switch */}
                    <div className='cursor-pointer scale-[0.8] sm:scale-100'>
                        <label className="relative flex justify-between items-center group p-2 text-xl">
                            <input
                                type="checkbox"
                                onChange={handleToggleCarousel}
                                checked={carouselEnabled}
                                disabled={isLoadingToggle}
                                className="absolute left-1/2 -translate-x-1/2 w-full h-full peer appearance-none rounded-md"
                            />
                            <span className="w-9 h-6 flex items-center flex-shrink-0 ml-4 p-1 bg-gray-400 rounded-full duration-300 ease-in-out peer-checked:bg-green-600 after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-md after:duration-300 peer-checked:after:translate-x-3 group-hover:after:translate-x-[2px]"></span>
                        </label>
                    </div>

                    {/* Delete Button */}
                    <div className={`${wantsToDelete ? "bg-btnPrimary" : "hover:bg-black hover:bg-opacity-[0.05]"} relative p-2 ml-3 active:scale-90 cursor-pointer group rounded-lg`} onClick={() => setWantsToDelete(!wantsToDelete)}>
                        <Image src={"https://linktree.sirv.com/Images/icons/trash.svg"} alt="delete" className={`${wantsToDelete ? "filter invert" : "opacity-60 group-hover:opacity-100"}`} height={17} width={17} />
                        {!wantsToDelete && <div
                            className={`nopointer group-hover:block hidden absolute -translate-x-1/2 left-1/2 translate-y-3 bg-black text-white text-sm rounded-lg px-2 py-1 after:absolute after:h-0 after:w-0 after:border-l-[6px] after:border-r-[6px] after:border-l-transparent after:border-r-transparent after:border-b-[8px] after:border-b-black after:-top-2 after:-translate-x-1/2 after:left-1/2`}
                        >{translations.deleteTooltip}</div>}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation */}
            <div className={`w-full flex flex-col ${wantsToDelete ? "h-[9.5rem]" : "h-0"} overflow-hidden transition-all duration-300`}>
                <div className='relative z-[1] w-full bg-purple-300 text-center sm:text-sm text-xs font-semibold py-1'>
                    {translations.deleteHeader}
                    <span className='absolute -translate-y-1/2 top-1/2 right-2 text-sm cursor-pointer' onClick={() => setWantsToDelete(false)}>
                        <FaX />
                    </span>
                </div>
                <div className='relative w-full text-center sm:text-sm text-xs font-semibold py-3'>
                    {translations.deleteConfirmationQuestion}
                </div>
                <div className='p-4 flex gap-5'>
                    <div className={`flex items-center gap-3 justify-center p-3 rounded-3xl cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] w-[10rem] flex-1 text-sm border`} onClick={() => setWantsToDelete(false)}>
                        {translations.cancelButton}
                    </div>
                    <div className={`flex items-center gap-3 justify-center p-3 rounded-3xl cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] w-[10rem] flex-1 text-sm bg-btnPrimary text-white`} onClick={handleDelete}>
                        {translations.deleteButton}
                    </div>
                </div>
            </div>
        </div>
    );
}
