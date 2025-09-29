"use client"
import { useDebounce } from "@/LocalHooks/useDebounce";
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD THIS IMPORT
import { generateRandomId, isValidURL } from "@/lib/utilities";
import React, { useContext, useEffect, useState, useMemo } from "react"; // ADD useMemo
import { FaAngleRight, FaPlus, FaX } from "react-icons/fa6";
import BrandItem from "./BrandItem";
import PickBrandModal from "../general components/PickBrandModal";
import { ManageLinksContent } from "../general components/ManageLinks";

export const addBtnContext = React.createContext();

export default function AddBtn() {
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK
    const [btnState, setBtnState] = useState(0);
    const [btnStyle, setBtnStyle] = useState(`p-3 cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] text-white bg-btnPrimary hover:bg-btnPrimaryAlt`)
    const [url, setUrl] = useState('');
    const debounceUrl = useDebounce(url, 500);
    const [urlValid, setUrlValid] = useState(false);
    const [modalShowing, setModalShowing] = useState(false);
    const { setData } = useContext(ManageLinksContent);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            addLink: t('dashboard.links.add_link'),
            enterUrl: t('dashboard.links.enter_url'),
            urlPlaceholder: t('dashboard.links.url_placeholder'),
            add: t('dashboard.links.add'),
            inspiredByInterest: t('dashboard.links.inspired_by_interest'),
            viewAll: t('dashboard.links.view_all'),
            // Brand items
            twitterHandle: t('dashboard.links.brands.twitter_handle'),
            tiktokProfile: t('dashboard.links.brands.tiktok_profile'),
            instagramHandle: t('dashboard.links.brands.instagram_handle'),
            videoLink: t('dashboard.links.brands.video_link'),
            musicLink: t('dashboard.links.brands.music_link')
        };
    }, [t, isInitialized]);

    const addItem = (params) => {
        const newItem = {
            id: generateRandomId(),
            title: `${params?.itemTitle !== undefined ? params?.itemTitle : ""}`,
            isActive: params?.itemUrl !== undefined && params?.itemUrl !== "",
            type: 1,
            url: `${params?.itemUrl !== undefined ? params?.itemUrl : ""}`,
            urlKind: `${params?.uniqueType !== undefined ? params?.uniqueType : ""}`
        }
        setData(prevData => {
            return [newItem, ...prevData];
        });

        setUrl("");
        handleClose();
        setModalShowing(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault()
        if (urlValid) {
            const data = {
                itemUrl: url
            }
            addItem(data);
        }
        return;
    }

    useEffect(() => {
        switch (btnState) {
            case 0:
                setBtnStyle(`p-3 cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] text-white bg-btnPrimary hover:bg-btnPrimaryAlt h-[3rem] overflow-visible`);
                break;
            case 1:
                setBtnStyle(`bg-white border sm:min-h-[20.5rem] min-h-[18rem] overflow-hidden`);
                break;

            default:
                break;
        }
    }, [btnState]);

    const handleInitialClick = () => {
        if (btnState === 0) {
            setBtnState(1);
        }
    }

    const handleClose = () => {
        if (btnState === 1) {
            setBtnState(0);
        }
    }

    useEffect(() => {
        if (url === '') {
            return;
        }

        if (!url.startsWith("https://")) {
            setUrl(`https://${url}`);
            return;
        }

        setUrlValid(isValidURL(url));
    }, [debounceUrl, url]);

    // LOADING STATE WHILE TRANSLATIONS LOAD
    if (!isInitialized) {
        return (
            <div className="p-3 h-[3rem] bg-gray-200 rounded-3xl animate-pulse flex items-center justify-center">
                <div className="h-4 w-20 bg-gray-300 rounded"></div>
            </div>
        );
    }

    const content = (
        btnState === 0 ?
            <div className="flex items-center gap-3 justify-center ">
                <FaPlus />
                <span>{translations.addLink}</span>
            </div>
            :
            <div className="w-full py-4 overflow-hidden linear">
                <div className="flex justify-between items-center text-sm duration-0 px-6">
                    <span className={'font-semibold'}>{translations.enterUrl}</span>
                    <div className={'p-2 hover:bg-black hover:bg-opacity-[0.05] active:scale-90 font-light rounded-full cursor-pointer'} onClick={handleClose}><FaX /></div>
                </div>
                <form className={'flex items-center gap-4 py-4 px-6 border-b max-w-full'} onSubmit={handleSubmit}>
                    <div className="flex-1 relative flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border border border-transparent">
                        <input
                            type="text"
                            className="flex-1 px-4 placeholder-shown:px-3 py-4 text-md outline-none opacity-100 bg-transparent peer appearance-none"
                            placeholder=" "
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                        <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-xs text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-40 transition duration-[250] ease-linear">
                            {translations.urlPlaceholder}
                        </label>
                    </div>
                    <button type="submit" className={`rounded-3xl py-3 px-6 ${urlValid ? "bg-btnPrimary text-white cursor-pointer" : "bg-black bg-opacity-[0.1] text-black cursor-not-allowed opacity-70"}`}>
                        {translations.add}
                    </button>
                </form>
                <section className="pt-4">
                    <div className="flex justify-between items-center text-sm duration-0 px-6">
                        <span className={'font-semibold opacity-40'}>{translations.inspiredByInterest}</span>
                        <div className={'flex gap-1 p-2 active:scale-90 font-light group text-btnPrimary cursor-pointer items-center'}>
                            <span className="group-hover:underline" onClick={() => setModalShowing(true)}>{translations.viewAll}</span>
                            <FaAngleRight />
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 px-6 py-3">
                        <div className="flex flex-wrap justify-center sm:gap-4 gap-2">
                            <BrandItem imgAlt={'tw icon'} btnData={{ itemTitle: translations.twitterHandle, itemUrl: "", uniqueType: "Twitter" }} imgSrc={"https://linktree.sirv.com/Images/brands/twitter.svg"} />
                            <BrandItem imgAlt={'tk icon'} btnData={{ itemTitle: translations.tiktokProfile, itemUrl: "", uniqueType: "TikTok Account" }} imgSrc={"https://linktree.sirv.com/Images/brands/tiktok.svg"} />
                            <BrandItem imgAlt={'hd icon'} btnData={{ itemTitle: translations.instagramHandle, itemUrl: "", uniqueType: "Instagram" }} imgSrc={"https://linktree.sirv.com/Images/brands/header.svg"} />
                            <BrandItem imgAlt={'vd icon'} btnData={{ itemTitle: translations.videoLink, itemUrl: "", uniqueType: "Video" }} imgSrc={"https://linktree.sirv.com/Images/brands/video.svg"} />
                            <BrandItem imgAlt={'mx icon'} btnData={{ itemTitle: translations.musicLink, itemUrl: "", uniqueType: "Music" }} imgSrc={"https://linktree.sirv.com/Images/brands/music.svg"} />
                        </div>
                    </div>
                </section>
            </div>
    );

    return (
        <addBtnContext.Provider value={{ addItem }}>
            <div className={`${btnStyle} rounded-3xl transition-[min-height]`} onClick={handleInitialClick}>
                {content}
                {modalShowing && <PickBrandModal closeFunction={setModalShowing} />}
            </div>
        </addBtnContext.Provider>
    );
}