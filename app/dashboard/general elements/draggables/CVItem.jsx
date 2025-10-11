//app/dashboard/general elements/draggables/CVItem.jsx
"use client"

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useContext, useMemo, useState, useEffect } from 'react';
import { FaX, FaGear } from 'react-icons/fa6';
import { FaFileAlt } from 'react-icons/fa';
import { ManageLinksContent } from '../../general components/ManageLinks';
import { useTranslation } from '@/lib/translation/useTranslation';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';
import { useDebounce } from '@/LocalHooks/useDebounce';

// CV Item Component - Type 3
export default function CVItem({ item, itemRef, style, listeners, attributes, isOverlay = false }) {
    const { t, isInitialized } = useTranslation();
    const { setData } = useContext(ManageLinksContent);
    const { currentUser } = useDashboard();
    const [wantsToDelete, setWantsToDelete] = useState(false);
    const [cvEnabled, setCvEnabled] = useState(false);
    const [cvItems, setCvItems] = useState([]);
    const [isLoadingToggle, setIsLoadingToggle] = useState(true);
    const [userToggledCV, setUserToggledCV] = useState(false);
    const router = useRouter();
    const debouncedCvEnabled = useDebounce(cvEnabled, 500);

    // Get the specific CV item this link refers to
    const linkedCvItem = cvItems.find(cv => cv.id === item.cvItemId);
    const cvTitle = linkedCvItem?.displayTitle || item.title || 'CV / Document';

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            cvTitleDefault: t('dashboard.links.item.cv_title_default') || 'CV / Document',
            cvDescription: t('dashboard.links.item.cv_description') || 'Drag to position where your CV will appear',
            customizeButton: t('dashboard.links.item.customize_cv') || 'Manage Document',
            deleteTooltip: t('dashboard.links.item.delete_tooltip') || 'Delete',
            deleteHeader: t('dashboard.links.item.delete_header') || 'Delete this item?',
            deleteConfirmationQuestion: t('dashboard.links.item.delete_confirmation_question') || 'Are you sure you want to delete this?',
            cancelButton: t('dashboard.links.item.cancel_button') || 'Cancel',
            deleteButton: t('dashboard.links.item.delete_button') || 'Delete',
        };
    }, [t, isInitialized]);

    // Load CV enabled state on mount and listen for real-time updates
    useEffect(() => {
        if (!currentUser?.uid) {
            setIsLoadingToggle(false);
            return;
        }

        // Initial load
        const loadInitialState = async () => {
            try {
                const appearance = await AppearanceService.getAppearanceData();
                setCvEnabled(appearance.cvEnabled || false);
                setCvItems(appearance.cvItems || []);
            } catch (error) {
                console.error('Error loading CV state:', error);
            } finally {
                setIsLoadingToggle(false);
            }
        };

        loadInitialState();

        // Set up real-time listener for CV changes
        const unsubscribe = AppearanceService.listenToAppearanceData(
            currentUser.uid,
            (appearance) => {
                const newCvEnabled = appearance.cvEnabled || false;
                const newCvItems = appearance.cvItems || [];
                setCvEnabled(newCvEnabled);
                setCvItems(newCvItems);
            }
        );

        // Cleanup listener on unmount
        return () => {
            unsubscribe();
        };
    }, [currentUser?.uid]);

    // Save CV enabled state when toggled by user
    useEffect(() => {
        if (isLoadingToggle || !userToggledCV) return; // Don't save on initial load or listener updates

        const saveCvState = async () => {
            try {
                await AppearanceService.updateAppearanceData({ cvEnabled }, { origin: 'manage-links', userId: currentUser?.uid });
                setUserToggledCV(false); // Reset flag after save
            } catch (error) {
                console.error('Error saving CV state:', error);
            }
        };

        saveCvState();
    }, [currentUser?.uid, debouncedCvEnabled, isLoadingToggle, cvEnabled, userToggledCV]);

    const handleToggleCV = (event) => {
        setCvEnabled(event.target.checked);
        setUserToggledCV(true); // Mark as user action
    };

    const handleDelete = async () => {
        // Remove from links
        setData(prevData => prevData.filter(i => i.id !== item.id));

        // Also remove the corresponding CV item from appearance
        if (item.cvItemId) {
            try {
                const appearance = await AppearanceService.getAppearanceData();
                const updatedCvItems = (appearance.cvItems || [])
                    .filter(cv => cv.id !== item.cvItemId)
                    .map((cv, index) => ({ ...cv, order: index }));

                await AppearanceService.updateAppearanceData({
                    cvItems: updatedCvItems
                }, { origin: 'manage-links', userId: currentUser?.uid });
            } catch (error) {
                console.error('Error deleting CV item from appearance:', error);
            }
        }
    };

    const handleManage = () => {
        // Navigate to appearance page with CV hash
        router.push('/dashboard/appearance#cv');

        // After navigation, scroll to the CV section
        setTimeout(() => {
            const cvSection = document.getElementById('cv');
            if (cvSection) {
                cvSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    };

    const containerClasses = `rounded-3xl border flex flex-col bg-gradient-to-r from-indigo-50 to-cyan-50 border-indigo-300 ${isOverlay ? 'shadow-lg' : ''}`;

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
                    {/* CV Title with Icon */}
                    <div className='flex gap-3 items-center'>
                        <span className='font-semibold text-indigo-700 flex items-center gap-2'>
                            <FaFileAlt className='w-5 h-5' />
                            {cvTitle}
                        </span>
                    </div>

                    {/* CV Description */}
                    <div className='text-sm text-indigo-600 opacity-80'>
                        {translations.cvDescription}
                    </div>

                    {/* Manage Button */}
                    <button
                        onClick={handleManage}
                        className='flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm w-fit'
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
                                onChange={handleToggleCV}
                                checked={cvEnabled}
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
                <div className='relative z-[1] w-full bg-indigo-300 text-center sm:text-sm text-xs font-semibold py-1'>
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
