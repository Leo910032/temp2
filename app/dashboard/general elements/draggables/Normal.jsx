"use client"

import { realEscapeString } from '@/lib/utilities';
import Image from 'next/image';
import { useContext, useEffect, useMemo, useRef, useState } from 'react'; // ADD useMemo
import { FaPencil, FaX } from 'react-icons/fa6';
import { ManageLinksContent } from '../../general components/ManageLinks';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { useTranslation } from '@/lib/translation/useTranslation'; // ADD THIS IMPORT

// --- PROPS HAVE CHANGED ---
// No longer uses `index`. Accepts dnd-kit props.
export default function Normal({ item, itemRef, style, listeners, attributes, isOverlay = false }) {
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK
    const { setData } = useContext(ManageLinksContent);
    const [editing, setEditing] = useState(false);
    const [textContent, setTextContent] = useState(item.title);
    const [wantsToDelete, setWantsToDelete] = useState(false);
    const titleRef = useRef();
    const [checkboxChecked, setCheckboxChecked] = useState(item.isActive);
    const debounceCheckbox = useDebounce(checkboxChecked, 500);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            enterTextPlaceholder: t('dashboard.links.item.enter_text_placeholder'),
            headlineTitleDefault: t('dashboard.links.item.headline_title_default'),
            deleteTooltip: t('dashboard.links.item.delete_tooltip'),
            deleteHeader: t('dashboard.links.item.delete_header'),
            deleteConfirmationQuestion: t('dashboard.links.item.delete_confirmation_question'),
            cancelButton: t('dashboard.links.item.cancel_button'),
            deleteButton: t('dashboard.links.item.delete_button'),
        };
    }, [t, isInitialized]);

    useEffect(() => {
        if (editing) {
            titleRef.current?.focus();
        }
    }, [editing]);

    const handleTriggerEditText = () => {
        if (!editing) {
            setEditing(true);
        }
    };

    const handleUpdateContent = (e) => {
        const inputType = e.nativeEvent.inputType;
        if (String(textContent).length < 35 || inputType === "deleteContentBackward") {
            const value = e.target.value;
            setTextContent(realEscapeString(value));
        }
    };

    const editArray = () => {
        setData(prevData =>
            prevData.map(i =>
                i.id === item.id ? { ...i, title: textContent } : i
            )
        );
    };

    const handleCheckboxChange = (event) => {
        setCheckboxChecked(event.target.checked);
    };

    const editArrayActiveStatus = () => {
        setData(prevData =>
            prevData.map(i =>
                i.id === item.id ? { ...i, isActive: checkboxChecked } : i
            )
        );
    };

    const handleDelete = () => {
        setData(prevData => prevData.filter(i => i.id !== item.id));
    };

    useEffect(() => {
        if (checkboxChecked !== item.isActive) {
            editArrayActiveStatus();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounceCheckbox]);

    useEffect(() => {
        if (!editing && textContent !== item.title) {
            editArray();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]);

    const containerClasses = `rounded-3xl border flex flex-col bg-white ${isOverlay ? 'shadow-lg' : ''}`;

    // LOADING STATE WHILE TRANSLATIONS LOAD
    if (!isInitialized) {
        return (
            <div ref={itemRef} style={style} className={`${containerClasses} h-[8rem] bg-gray-200 animate-pulse`}>
                {/* You can add more detailed skeleton elements here if needed */}
            </div>
        )
    }

    return (
        // 1. REMOVED Draggable wrapper. Main container gets ref and style.
        <div
            ref={itemRef}
            style={style}
            className={containerClasses}
        >
            <div className={`h-[8rem] items-center flex`}>
                {/* 2. Drag handle gets listeners and attributes */}
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
                <div className='flex-1 flex flex-col px-3'>
                    <div className='flex gap-3 items-center mx-auto opacity-100 cursor-pointer' onClick={handleTriggerEditText}>
                        {editing && <input
                            type="text"
                            className='w-auto text-center border-none outline-none'
                            placeholder={translations.enterTextPlaceholder}
                            onChange={handleUpdateContent}
                            onBlur={() => setEditing(false)}
                            value={textContent}
                            ref={titleRef}
                        />}
                        {!editing && <span>{textContent === "" ? translations.headlineTitleDefault : textContent}</span>}
                        {!editing && <FaPencil className='text-sm' />}
                    </div>
                    {editing && <div className='text-sm mt-2 opacity-70'>
                        <span className={`${String(textContent).length < 35 ? "text-black" : "text-red-400"}`}>{String(textContent).length}</span><span>/</span><span>35</span>
                    </div>}
                </div>
                <div className='grid sm:pr-2 gap-2 place-items-center'>
                    <div className='cursor-pointer scale-[0.8] sm:scale-100'>
                        <label className="relative flex justify-between items-center group p-2 text-xl">
                            <input type="checkbox" onChange={handleCheckboxChange} checked={checkboxChecked} className="absolute left-1/2 -translate-x-1/2 w-full h-full peer appearance-none rounded-md" />
                            <span className="w-9 h-6 flex items-center flex-shrink-0 ml-4 p-1 bg-gray-400 rounded-full duration-300 ease-in-out peer-checked:bg-green-600 after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-md after:duration-300 peer-checked:after:translate-x-3 group-hover:after:translate-x-[2px]"></span>
                        </label>
                    </div>
                    <div className={`${wantsToDelete ? "bg-btnPrimary" : "hover:bg-black hover:bg-opacity-[0.05]"} relative p-2 ml-3 active:scale-90 cursor-pointer group rounded-lg`} onClick={() => setWantsToDelete(!wantsToDelete)}>
                        <Image src={"https://linktree.sirv.com/Images/icons/trash.svg"} alt="delete" className={`${wantsToDelete ? "filter invert" : "opacity-60 group-hover:opacity-100"}`} height={17} width={17} />
                        {!wantsToDelete && <div
                            className={`nopointer group-hover:block hidden absolute -translate-x-1/2 left-1/2 translate-y-3 bg-black text-white text-sm rounded-lg px-2 py-1 after:absolute after:h-0 after:w-0 after:border-l-[6px] after:border-r-[6px] after:border-l-transparent after:border-r-transparent after:border-b-[8px] after:border-b-black after:-top-2 after:-translate-x-1/2 after:left-1/2`}
                        >{translations.deleteTooltip}</div>}
                    </div>
                </div>
            </div>

            <div className={`w-full flex flex-col ${wantsToDelete ? "h-[9.5rem]" : "h-0"} overflow-hidden transition-all duration-300`}>
                <div className='relative z-[1] w-full bg-gray-300 text-center sm:text-sm text-xs font-semibold py-1'>
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