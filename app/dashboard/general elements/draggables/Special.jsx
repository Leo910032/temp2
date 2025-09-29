"use client"

import { isValidURL, realEscapeString } from '@/lib/utilities';
import Image from 'next/image';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FaPencil, FaX } from 'react-icons/fa6';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { ManageLinksContent } from '../../general components/ManageLinks';
import { useTranslation } from '@/lib/translation/useTranslation';

// --- PROPS HAVE CHANGED ---
export default function Special({ item, itemRef, style, listeners, attributes, isOverlay = false }) {
    const { t, isInitialized } = useTranslation();
    const { setData } = useContext(ManageLinksContent);
    const [editingTitle, setEditingTitle] = useState(false);
    const [editingUrl, setEditingUrl] = useState(false);
    const [titleText, setTitleText] = useState(item.title);
    const [urlText, setUrlText] = useState(item.url);
    const [wantsToDelete, setWantsToDelete] = useState(false);
    const [urlIsValid, setUrIslValid] = useState(0);
    const titleRef = useRef();
    const urlRef = useRef();
    const debounceUrl = useDebounce(urlText, 500);
    const [checkboxChecked, setCheckboxChecked] = useState(item.isActive);
    const debounceCheckbox = useDebounce(checkboxChecked, 500);
    const [contentFilled, setContentFilled] = useState(false);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            enterTextPlaceholder: t('dashboard.links.item.enter_text_placeholder'),
            headlineTitleDefault: t('dashboard.links.item.headline_title_default'),
            urlPlaceholder: t('dashboard.links.item.url_placeholder'),
            invalidUrlMessage: t('dashboard.links.item.invalid_url_message'),
            deleteTooltip: t('dashboard.links.item.delete_tooltip'),
            deleteHeader: t('dashboard.links.item.delete_header'),
            deleteConfirmationQuestion: t('dashboard.links.item.delete_confirmation_question'),
            cancelButton: t('dashboard.links.item.cancel_button'),
            deleteButton: t('dashboard.links.item.delete_button'),
            setupLinkPrompt: t('dashboard.links.item.setup_link_prompt'),
            customKind: t('dashboard.links.item.custom_kind'),
            // ADD THIS NEW TRANSLATION KEY
            toggleDisabledTooltip: t('dashboard.links.item.toggle_disabled_tooltip'),
        };
    }, [t, isInitialized]);

    const editArrayActiveStatus = () => {
        setData(prevData =>
            prevData.map(i =>
                i.id === item.id ? { ...i, isActive: checkboxChecked } : i
            )
        );
    };

    const editArrayTitle = () => {
        setData(prevData =>
            prevData.map(i =>
                i.id === item.id ? { ...i, title: titleText } : i
            )
        );
    };

    const editArrayUrl = () => {
        setData(prevData =>
            prevData.map(i =>
                i.id === item.id ? { ...i, url: urlText } : i
            )
        );
    };

    useEffect(() => {
        if (!editingUrl && urlText !== item.url) {
            editArrayUrl();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingUrl]);

    useEffect(() => {
        if (!editingTitle && titleText !== item.title) {
            editArrayTitle();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingTitle]);

    useEffect(() => {
        if (checkboxChecked !== item.isActive) {
            editArrayActiveStatus();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounceCheckbox]);

    useEffect(() => {
        if (urlText !== "") {
            setUrIslValid(isValidURL(urlText) ? 2 : 1);
        } else {
            setUrIslValid(0);
        }
    }, [debounceUrl, urlText]);

    const handleTriggerEditTitle = () => {
        if (!editingTitle) setEditingTitle(true);
    };

    const handleTriggerEditUrl = () => {
        if (!editingUrl) setEditingUrl(true);
    };

    const handleUpdateTitle = (e) => {
        const value = e.target.value;
        if (value.length <= 35 || e.nativeEvent.inputType === "deleteContentBackward") {
            setTitleText(realEscapeString(value));
        }
    };

    const handleDelete = () => {
        setData(prevData => prevData.filter(i => i.id !== item.id));
    };

    const handleCheckboxChange = (event) => {
        if (contentFilled) {
            setCheckboxChecked(event.target.checked);
        }
    };

    const handleUpdateUrl = (e) => {
        const value = e.target.value;
        if (value.length <= 60 || e.nativeEvent.inputType === "deleteContentBackward") {
            setUrlText(realEscapeString(value));
        }
    };



useEffect(() => {
        const wasContentFilled = contentFilled;
        const isContentNowFilled = urlIsValid === 2;
        setContentFilled(isContentNowFilled);
        
        // ✅ TEMPORARILY DISABLE AUTO-DEACTIVATION FOR DEBUGGING
        // Only auto-deactivate if URL was valid before but is now invalid (user deleted/corrupted URL)
        if (wasContentFilled && !isContentNowFilled && checkboxChecked) {
            console.log('Auto-deactivating link due to invalid URL:', titleText || 'Untitled');
            console.log('URL validation details:', { urlText, urlIsValid });
            setCheckboxChecked(false);
        }
        
        // ✅ LOG VALIDATION STATE CHANGES
        if (wasContentFilled !== isContentNowFilled) {
            console.log(`Content filled changed for "${titleText}":`, { 
                from: wasContentFilled, 
                to: isContentNowFilled, 
                url: urlText, 
                validationCode: urlIsValid 
            });
        }
    }, [urlIsValid, checkboxChecked, titleText, contentFilled, urlText]);


    const containerClasses = `rounded-3xl border flex flex-col bg-white ${urlText === '' ? 'border-themeYellow' : ''} ${isOverlay ? 'shadow-lg' : ''}`;

    if (!isInitialized) {
        return (
            <div ref={itemRef} style={style} className={`rounded-3xl border flex flex-col bg-white h-[10.5rem] bg-gray-200 animate-pulse`}>
                {/* Skeleton UI */}
            </div>
        );
    }

    return (
        <div ref={itemRef} style={style} className={containerClasses}>
            <div className={`h-[8rem] items-center flex`}>
                <div className='active:cursor-grabbing h-full min-w-fit px-4 grid place-items-center touch-none' {...listeners} {...attributes}>
                    <Image src={"https://linktree.sirv.com/Images/icons/drag.svg"} alt='drag icon' height={15} className='object-contain' width={15}/>
                </div>

                <div className='flex-1 flex flex-col gap-1'>
                    <div className='flex gap-3 items-center text-base cursor-pointer w-[95%]' onClick={handleTriggerEditTitle}>
                        {editingTitle ? <input type="text" className='sm:w-auto border-none outline-none' placeholder={translations.enterTextPlaceholder} onChange={handleUpdateTitle} onBlur={() => setEditingTitle(false)} value={titleText} ref={titleRef}/> : <>
                            <span className='sm:font-semibold font-bold sm:text-base text-sm'>{titleText === "" ? translations.headlineTitleDefault : titleText}</span>
                            <FaPencil className='text-xs' />
                        </>}
                    </div>
                    <div className='flex gap-3 items-center relative text-sm opacity-100 cursor-pointer w-full' onClick={handleTriggerEditUrl}>
                        {editingUrl ? <input type="text" className={`w-[10rem] sm:w-fit border-none outline-none sm:flex-1`} placeholder={translations.urlPlaceholder} onChange={handleUpdateUrl} onBlur={() => setEditingUrl(false)} value={urlText} ref={urlRef}/> : <>
                            <span className={`w-[10rem] truncate sm:w-fit ${urlIsValid === 1 ? 'text-red-500' : ''}`}>{urlText === "" ? translations.urlPlaceholder : urlText}</span>
                            <FaPencil className='text-xs' />
                        </>}
                        {urlIsValid === 1 && <div className={`z-[999] nopointer absolute translate-y-7 font-semibold bg-red-500 text-white text-xs rounded px-2 py-1 after:absolute after:h-0 after:w-0 after:border-l-[6px] after:border-r-[6px] after:border-l-transparent after:border-r-transparent after:border-b-[8px] after:border-b-red-500 after:-top-2 after:left-3`}>{translations.invalidUrlMessage}</div>}
                    </div>
                </div>
                <div className='grid sm:pr-2 gap-2 place-items-center'>
                    {/* --- MODIFICATION START --- */}
                    <div className={`relative group scale-[0.8] sm:scale-100 ${!contentFilled ? "opacity-60" : ""} min-w-fit`}>
                        <label className={`relative flex justify-between items-center p-2 text-xl ${contentFilled ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                            <input type="checkbox" onChange={handleCheckboxChange} checked={checkboxChecked} className="absolute left-1/2 -translate-x-1/2 w-full h-full peer appearance-none rounded-md" />
                            <span className="w-9 h-6 flex items-center flex-shrink-0 ml-4 p-1 bg-gray-400 rounded-full duration-300 ease-in-out peer-checked:bg-green-600 after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-md after:duration-300 peer-checked:after:translate-x-3 group-hover:after:translate-x-[2px]"></span>
                        </label>
                        {!contentFilled && (
                            <div className={`nopointer group-hover:block hidden absolute z-10 w-max max-w-xs -translate-x-full -left-2 top-1/2 -translate-y-1/2 bg-black text-white text-sm rounded-lg px-2 py-1 after:absolute after:h-0 after:w-0 after:border-t-[6px] after:border-b-[6px] after:border-t-transparent after:border-b-transparent after:border-l-[8px] after:border-l-black after:-right-2 after:top-1/2 after:-translate-y-1/2`}>
                                {translations.toggleDisabledTooltip}
                            </div>
                        )}
                    </div>
                    {/* --- MODIFICATION END --- */}
                    <div className={`${wantsToDelete ? "bg-btnPrimary" : "hover:bg-black hover:bg-opacity-[0.05]"} relative p-2 ml-3 active:scale-90 cursor-pointer group rounded-lg min-w-fit`} onClick={() => setWantsToDelete(!wantsToDelete)}>
                        <Image src={"https://linktree.sirv.com/Images/icons/trash.svg"} alt="delete" className={`${wantsToDelete ? "filter invert" : "opacity-60 group-hover:opacity-100"}`} height={17} width={17} />
                        {!wantsToDelete && <div className={`z-[999] nopointer group-hover:block hidden absolute -translate-x-1/2 left-1/2 translate-y-3 bg-black text-white text-sm rounded-lg px-2 py-1 after:absolute after:h-0 after:w-0 after:border-l-[6px] after:border-r-[6px] after:border-l-transparent after:border-r-transparent after:border-b-[8px] after:border-b-black after:-top-2 after:-translate-x-1/2 after:left-1/2`}>{translations.deleteTooltip}</div>}
                    </div>
                </div>
            </div>

            <div className={`w-full flex flex-col ${wantsToDelete ? "h-[9.5rem]" : "h-0"} overflow-hidden transition-all duration-300`}>
                <div className='relative z-[1] w-full bg-gray-300 text-center sm:text-sm text-xs font-semibold py-1'>
                    {translations.deleteHeader}
                    <span className='absolute -translate-y-1/2 top-1/2 right-2 text-sm cursor-pointer' onClick={() => setWantsToDelete(false)}><FaX /></span>
                </div>
                <div className='relative w-full text-center sm:text-sm text-xs font-semibold py-3'>{translations.deleteConfirmationQuestion}</div>
                <div className='p-4 flex gap-5'>
                    <div className={`flex items-center gap-3 justify-center p-3 rounded-3xl cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] w-[10rem] flex-1 text-sm border`} onClick={() => setWantsToDelete(false)}>{translations.cancelButton}</div>
                    <div className={`flex items-center gap-3 justify-center p-3 rounded-3xl cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] w-[10rem] flex-1 text-sm bg-btnPrimary text-white`} onClick={handleDelete}>{translations.deleteButton}</div>
                </div>
            </div>
            {!wantsToDelete && <div className='overflow-hidden rounded-b-3xl border-t border-themeYellow'>
                <div className='px-6 py-3 sm:text-sm text-xs bg-themeYellowLight'>{translations.setupLinkPrompt.replace('{{kind}}', item.urlKind || translations.customKind)}</div>
            </div>}
        </div>
    );
}