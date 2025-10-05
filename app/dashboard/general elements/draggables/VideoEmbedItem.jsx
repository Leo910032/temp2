//app/dashboard/general elements/draggables/VideoEmbedItem.jsx
"use client"

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useContext, useMemo, useState, useEffect } from 'react';
import { FaX } from 'react-icons/fa6';
import { ManageLinksContent } from '../../general components/ManageLinks';
import { useTranslation } from '@/lib/translation/useTranslation';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { APPEARANCE_FEATURES } from '@/lib/services/constants';
import { toast } from 'react-hot-toast';

// Video Embed Item Component - Type 4
export default function VideoEmbedItem({ item, itemRef, style, listeners, attributes, isOverlay = false }) {
    const { t, isInitialized } = useTranslation();
    const { setData } = useContext(ManageLinksContent);
    const { currentUser, permissions, subscriptionLevel } = useDashboard();
    const [wantsToDelete, setWantsToDelete] = useState(false);
    const [videoEmbedEnabled, setVideoEmbedEnabled] = useState(false);
    const [isLoadingToggle, setIsLoadingToggle] = useState(true);
    const [userToggledVideoEmbed, setUserToggledVideoEmbed] = useState(false);
    const router = useRouter();
    const debouncedVideoEmbedEnabled = useDebounce(videoEmbedEnabled, 500);

    // Check if user has permission to use video embed
    const canUseVideoEmbed = permissions[APPEARANCE_FEATURES.CUSTOM_VIDEO_EMBED];
    const hasExistingVideoEmbeds = videoEmbedEnabled; // User had video embeds before downgrade

    // 🆕 Monitor permission changes in real-time
    useEffect(() => {
        console.log('🔄 [VideoEmbedItem] Permissions updated:', {
            canUseVideoEmbed,
            subscriptionLevel,
            timestamp: new Date().toISOString()
        });
    }, [canUseVideoEmbed, subscriptionLevel]);

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            videoEmbedTitle: t('dashboard.links.item.video_embed_title_default') || 'Video Embed',
            videoEmbedDescription: t('dashboard.links.item.video_embed_description') || 'Display an embedded video on your profile',
            customizeButton: t('dashboard.links.item.customize_video_embed') || 'Customize',
            deleteTooltip: t('dashboard.links.item.delete_tooltip') || 'Delete',
            deleteHeader: t('dashboard.links.item.delete_header') || 'Delete this item?',
            deleteConfirmationQuestion: t('dashboard.links.item.delete_confirmation_question') || 'Are you sure you want to delete this?',
            cancelButton: t('dashboard.links.item.cancel_button') || 'Cancel',
            deleteButton: t('dashboard.links.item.delete_button') || 'Delete',
        };
    }, [t, isInitialized]);

    // Load video embed enabled state on mount and listen for real-time updates
    useEffect(() => {
        if (!currentUser?.uid) {
            setIsLoadingToggle(false);
            return;
        }

        // Initial load
        const loadInitialState = async () => {
            try {
                const appearance = await AppearanceService.getAppearanceData();
                setVideoEmbedEnabled(appearance.videoEmbedEnabled || false);
            } catch (error) {
                console.error('Error loading video embed state:', error);
            } finally {
                setIsLoadingToggle(false);
            }
        };

        loadInitialState();

        // Set up real-time listener for video embed changes
        const unsubscribe = AppearanceService.listenToAppearanceData(
            currentUser.uid,
            (appearance) => {
                const newVideoEmbedEnabled = appearance.videoEmbedEnabled || false;
                setVideoEmbedEnabled(newVideoEmbedEnabled);
            }
        );

        // Cleanup listener on unmount
        return () => {
            unsubscribe();
        };
    }, [currentUser?.uid]);

    // Save video embed enabled state when toggled by user
    useEffect(() => {
        if (isLoadingToggle || !userToggledVideoEmbed) return;

        const saveVideoEmbedState = async () => {
            try {
                await AppearanceService.updateAppearanceData({
                    videoEmbedEnabled: videoEmbedEnabled
                });
                setUserToggledVideoEmbed(false);
            } catch (error) {
                console.error('Error saving video embed state:', error);
            }
        };

        saveVideoEmbedState();
    }, [debouncedVideoEmbedEnabled, isLoadingToggle, videoEmbedEnabled, userToggledVideoEmbed]);

    const handleToggleVideoEmbed = (event) => {
        // Prevent toggle if user doesn't have permission
        if (!canUseVideoEmbed) {
            const requiredTier = subscriptionLevel === 'base' ? 'Pro' : 'Pro';
            toast.error(`Upgrade to ${requiredTier} to enable Video Embed`, {
                duration: 4000,
                style: {
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: 'bold',
                }
            });
            return;
        }
        setVideoEmbedEnabled(event.target.checked);
        setUserToggledVideoEmbed(true);
    };

    const handleDelete = () => {
        setData(prevData => prevData.filter(i => i.id !== item.id));
    };

    const handleCustomize = () => {
        // Prevent customization if user doesn't have permission
        if (!canUseVideoEmbed) {
            const requiredTier = subscriptionLevel === 'base' ? 'Pro' : 'Pro';
            toast.error(`Upgrade to ${requiredTier} to customize Video Embed`, {
                duration: 4000,
                style: {
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: 'bold',
                }
            });
            return;
        }

        // Navigate to appearance page with video-embed hash
        router.push('/dashboard/appearance#video-embed');

        // After navigation, scroll to the video embed section
        setTimeout(() => {
            const videoEmbedSection = document.getElementById('video-embed');
            if (videoEmbedSection) {
                videoEmbedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    };

    // Grey out if user doesn't have permission
    const containerClasses = `rounded-3xl border flex flex-col ${
        !canUseVideoEmbed
            ? 'bg-gray-100 border-gray-300 opacity-60'
            : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-300'
    } ${isOverlay ? 'shadow-lg' : ''}`;

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
                    {/* Video Embed Title with Icon */}
                    <div className='flex gap-3 items-center'>
                        <span className={`font-semibold flex items-center gap-2 ${
                            !canUseVideoEmbed ? 'text-gray-500' : 'text-red-700'
                        }`}>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                            </svg>
                            {translations.videoEmbedTitle}
                        </span>
                        {/* Show upgrade badge if no permission */}
                        {!canUseVideoEmbed && (
                            <span className='text-xs px-2 py-0.5 bg-amber-500 text-white rounded-full font-semibold'>
                                Pro Required
                            </span>
                        )}
                    </div>

                    {/* Video Embed Description */}
                    <div className={`text-sm opacity-80 ${
                        !canUseVideoEmbed ? 'text-gray-500' : 'text-red-600'
                    }`}>
                        {!canUseVideoEmbed
                            ? 'Upgrade to Pro or Premium to use this feature'
                            : 'Drag to position where your video will appear'
                        }
                    </div>

                    {/* Customize Button */}
                    <button
                        onClick={handleCustomize}
                        disabled={!canUseVideoEmbed}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm w-fit ${
                            !canUseVideoEmbed
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                    >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        <span>{translations.customizeButton}</span>
                    </button>
                </div>

                {/* Toggle and Delete Buttons */}
                <div className='grid sm:pr-2 gap-2 place-items-center'>
                    {/* Toggle Switch */}
                    <div className={`scale-[0.8] sm:scale-100 ${canUseVideoEmbed ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <label className="relative flex justify-between items-center group p-2 text-xl">
                            <input
                                type="checkbox"
                                onChange={handleToggleVideoEmbed}
                                checked={videoEmbedEnabled}
                                disabled={isLoadingToggle || !canUseVideoEmbed}
                                className="absolute left-1/2 -translate-x-1/2 w-full h-full peer appearance-none rounded-md"
                            />
                            <span className={`w-9 h-6 flex items-center flex-shrink-0 ml-4 p-1 rounded-full duration-300 ease-in-out after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-md after:duration-300 ${
                                !canUseVideoEmbed
                                    ? 'bg-gray-300 opacity-50'
                                    : 'bg-gray-400 peer-checked:bg-green-600 peer-checked:after:translate-x-3 group-hover:after:translate-x-[2px]'
                            }`}></span>
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
                <div className='relative z-[1] w-full bg-red-300 text-center sm:text-sm text-xs font-semibold py-1'>
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
