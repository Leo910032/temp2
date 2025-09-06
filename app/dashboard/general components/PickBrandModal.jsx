import { AddContents } from "@/lib/BrandLinks";
import BrandAdd from "../general elements/brandAdd";
import { FaX } from "react-icons/fa6";
import { capitalizeFirstLetter } from "@/lib/utilities";
import { useTranslation } from "@/lib/translation/useTranslation"; // ADD THIS IMPORT
import { useMemo } from "react"; // ADD THIS IMPORT

export default function PickBrandModal({closeFunction}) {
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            addToLinktree: t('dashboard.modals.add_to_linktree'),
            shareYourContent: t('dashboard.modals.share_your_content'),
            shareContentDirectly: t('dashboard.modals.share_content_directly'),
            link: t('common.link')
        };
    }, [t, isInitialized]);

    const handlerClose = () =>{
        closeFunction(false);
    }

    // SHOW LOADING STATE WHILE TRANSLATIONS LOAD
    if (!isInitialized) {
        return (
            <div className="h-screen w-screen z-[9999999999] fixed top-0 left-0 grid place-items-center">
                <div className="absolute top-0 left-0 h-full w-full bg-black backdrop-blur-[1px] bg-opacity-[0.25]" onClick={handlerClose}></div>
                <main className="bg-white relative z-10 shadow-xl w-[80vw] min-w-[20rem] flex flex-col rounded-3xl enter">
                    <div className="px-8 py-5 flex w-full border-b font-semibold justify-between items-center">
                        <span></span>
                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                        <div className="p-3 hover:bg-black hover:bg-opacity-[0.05] cursor-pointer rounded-lg active:scale-90" onClick={handlerClose}><FaX className="text-sm font-thin" /></div>
                    </div>
                    <div className="md:px-12 px-3 py-5 sm:max-h-[73vh] max-h-[60vh] overflow-y-auto">
                        <div className="grid mb-5 px-2">
                            <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-2"></div>
                            <div className="h-4 w-56 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen z-[9999999999] fixed top-0 left-0 grid place-items-center">
            <div className="absolute top-0 left-0 h-full w-full bg-black backdrop-blur-[1px] bg-opacity-[0.25]" onClick={handlerClose}></div>
            <main className="bg-white relative z-10 shadow-xl w-[80vw] min-w-[20rem] flex flex-col rounded-3xl enter">
                <div className="px-8 py-5 flex  w-full border-b font-semibold justify-between items-center">
                    <span></span>
                    <span className="text-base">{translations.addToLinktree}</span>
                    <div className="p-3 hover:bg-black hover:bg-opacity-[0.05] cursor-pointer rounded-lg active:scale-90" onClick={handlerClose}><FaX className="text-sm font-thin" /></div>
                </div>
                <div className="md:px-12 px-3 py-5 sm:max-h-[73vh] max-h-[60vh] overflow-y-auto">
                    <section>
                        <div className="grid mb-5 px-2">
                            <span className="font-semibold">{translations.shareYourContent}</span>
                            <span className="opacity-60 text-sm">{translations.shareContentDirectly}</span>
                        </div>
                        <div className="flex flex-wrap sm:px-4 px-0 pb-4 gap-x-5 gap-y-2">
                            {AddContents.map((content, index) => (
                                <BrandAdd
                                    btnData={{ 
                                        itemTitle: `${capitalizeFirstLetter(content.title)} ${translations.link}`, 
                                        itemUrl: "", 
                                        uniqueType: `${capitalizeFirstLetter(content.title)}` 
                                    }}
                                    imgAlt={content.alt}
                                    imgSrc={content.src}
                                    title={content.title}
                                    p={content.p}
                                    key={index}
                                />
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}