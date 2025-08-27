"use client"
import { useEffect, useState, useMemo } from "react"; // ADD useMemo
import { useTranslation } from "@/lib/translation/useTranslation"; // Fixed import path
import "../../styles/3d.css";
import { FaArrowLeft, FaArrowRightArrowLeft, FaArrowUp } from "react-icons/fa6";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/LocalHooks/useDebounce";
import Image from "next/image";
import { collection, onSnapshot } from "firebase/firestore";
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";

export default function Form() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation(); // ADD TRANSLATION HOOK
    const [existingUsernames, setExistingUsernames] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(0);
    const [canProceed, setCanProceed] = useState(false);
    const [username, setUsername] = useState("");
    const router = useRouter();
    const [errorMessage, setErrorMessage] = useState("");
    const debouncedUsername = useDebounce(username, 500);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            mainTitle: t('landing.hero.main_title'),
            subtitle: t('landing.hero.subtitle'),
            placeholder: t('landing.form.placeholder'),
            usernameTaken: t('landing.form.errors.username_taken'),
            usernameTooShort: t('landing.form.errors.username_too_short'),
            invalidFormat: t('landing.form.errors.invalid_format'),
            loadingAlt: t('common.loading')
        };
    }, [t, isInitialized]);

    // Redirect if user is already logged in
    useEffect(() => {
        if (currentUser) {
            router.push("/dashboard");
        }
    }, [currentUser, router]);

    useEffect(() => {
        if (username !== "") {
            if (existingUsernames.includes(String(username).toLowerCase())) {
                setHasError(1);
                setCanProceed(false);
                setErrorMessage(translations.usernameTaken || "This username is already taken.");
                return;
            }
            
            if (username.length < 3) {
                setHasError(1);
                setCanProceed(false);
                setErrorMessage(translations.usernameTooShort || "Username is too short.");
                return;
            }

            if (/[^a-zA-Z0-9\-_]/.test(username)) {
                setHasError(1);
                setCanProceed(false);
                setErrorMessage(translations.invalidFormat || "Invalid username format");
                return;
            }

            setHasError(2);
            setCanProceed(true);
            return;
        } else {
            setHasError(0);
            setCanProceed(false);
        }
    }, [debouncedUsername, existingUsernames, translations]);

    const handleSumbit = (e) => { 
        e.preventDefault();
        if (canProceed && !isLoading) {
            setIsLoading(true);
            // Store username in localStorage temporarily for the signup process
            localStorage.setItem("pendingUsername", username);
            router.push("/signup");
            setCanProceed(false);
        }
    }

    useEffect(() => {
        function fetchExistingUsername() {
            const existingUsernames = [];
        
            // Check both AccountData (new Firebase Auth users) and accounts (old users)
            const accountDataRef = collection(fireApp, "AccountData");
            const accountsRef = collection(fireApp, "accounts");
        
            // Listen to AccountData collection
            const unsubscribeAccountData = onSnapshot(accountDataRef, (querySnapshot) => {
                const newUsernames = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.username) {
                        newUsernames.push(String(data.username).toLowerCase());
                    }
                });
                
                // Listen to accounts collection (legacy)
                const unsubscribeAccounts = onSnapshot(accountsRef, (querySnapshot) => {
                    const allUsernames = [...newUsernames];
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        if (data.username) {
                            allUsernames.push(String(data.username).toLowerCase());
                        }
                    });
                    
                    setExistingUsernames(allUsernames);
                });

                return unsubscribeAccounts;
            });

            return unsubscribeAccountData;
        }

        const unsubscribe = fetchExistingUsername();

        // 3D Animation Effect
        const container = document.getElementById("container");
        const inner = document.getElementById("inner");
        const inputDiv = document.getElementById("input");

        if (!container || !inner || !inputDiv) return;

        // Mouse tracking object
        const mouse = {
            _x: 0,
            _y: 0,
            x: 0,
            y: 0,
            updatePosition: function (event) {
                const e = event || window.event;
                this.x = e.clientX - this._x;
                this.y = (e.clientY - this._y) * -1;
            },
            setOrigin: function (e) {
                this._x = e.offsetLeft + Math.floor(e.offsetWidth / 2);
                this._y = e.offsetTop + Math.floor(e.offsetHeight / 2);
            },
            show: function () {
                return "(" + this.x + ", " + this.y + ")";
            },
        };

        // Track the mouse position relative to the center of the container.
        mouse.setOrigin(container);

        let counter = 0;
        const updateRate = 10;
        const isTimeToUpdate = function () {
            return counter++ % updateRate === 0;
        };

        const onMouseEnterHandler = function (event) {
            update(event);
        };

        const onMouseLeaveHandler = function () {
            inner.style = "";
        };

        const onMouseMoveHandler = function (event) {
            if (isTimeToUpdate()) {
                update(event);
            }
        };

        const update = function (event) {
            mouse.updatePosition(event);
            updateTransformStyle(
                (mouse.y / inner.offsetHeight / 2).toFixed(2),
                (mouse.x / inner.offsetWidth / 2).toFixed(2)
            );
        };

        const updateTransformStyle = function (x, y) {
            const style = `rotateX(${x}deg) rotateY(${y}deg)`;
            inner.style.transform = style;
            inner.style.webkitTransform = style;
            inner.style.mozTransform = style;
            inner.style.msTransform = style;
            inner.style.oTransform = style;
            inputDiv.style.transform = `translateZ(10rem)`;
        };

        document.onmouseenter = onMouseEnterHandler;
        document.onmouseleave = onMouseLeaveHandler;
        document.onmousemove = onMouseMoveHandler;

        // Cleanup function
        return () => {
            document.onmouseenter = null;
            document.onmouseleave = null;
            document.onmousemove = null;
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, []);

    // Don't render if user is already logged in
    if (currentUser) {
        return null;
    }

    // LOADING STATE FOR TRANSLATIONS
    if (!isInitialized) {
        return (
            <div className="w-fit h-fit z-10" id="container">
                <div className="flex items-center justify-center flex-col" id="inner">
                    <div className="h-12 w-96 bg-white bg-opacity-20 rounded animate-pulse mb-4"></div>
                    <div className="h-6 w-80 bg-white bg-opacity-20 rounded animate-pulse mb-8"></div>
                    <div className="h-16 w-72 bg-white bg-opacity-20 rounded-xl animate-pulse"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-fit h-fit z-10" id="container">
            <form className="flex items-center justify-center flex-col" id="inner" onSubmit={handleSumbit}>
                <div className="text-[2.15rem] sm:text-[3rem] md:text-[4rem] font-bold text-white z-10 mb-4 max-w-[70vw] text-center">
                    {translations.mainTitle}
                </div>
                <div className="max-w-[60vw] text-center font-semibold text-sm sm:text-lg opacity-80 z-10 text-white mb-8">
                    {translations.subtitle}
                </div>
                <div className={`flex items-stretch gap-2 relative filter ${hasError === 1 ? "dropshadow-bad" : hasError === 2 ? "dropshadow-good" : "dropshadow"}`} id="input">
                    <div className={`flex items-center rounded-l-xl bg-white px-6 text-sm md:text-2xl sm:text-md ${hasError === 1 ? "border-red-500 border-[2px]" : hasError === 2 ? "border-green-500 border-[2px]" : ""}`}>
                        <label className="opacity-40 font-semibold">tapit.fr/:</label>
                        <input 
                            type="text" 
                            className="bg-transparent peer py-5 px-2 outline-none border-none md:w-auto w-[8rem]" 
                            placeholder={translations.placeholder}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                        />
                    </div>
                    <button type="submit" className={`px-4 grid place-items-center ${canProceed ? "bg-themeGreen text-white": "bg-slate-400 text-white"} rounded-r-xl font-semibold cursor-pointer hover:scale-110 active:scale-95 active:opacity-80 uppercase text-sm md:text-lg sm:text-md`}>
                        {!isLoading && <span className="nopointer">
                            {hasError === 1 ?
                                <FaArrowLeft />
                                : hasError === 2 ?
                                    <FaArrowRightArrowLeft />
                                    :
                                    <FaArrowUp />
                            }
                        </span>}
                        {isLoading && <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt={translations.loadingAlt} className=" mix-blend-screen" />}
                    </button>
                </div>
                {hasError === 1 && <div className="p-4 max-w-[70vw] text-center text-red-500 filter drop-shadow-md shadow-white text-sm">{errorMessage}</div>}
            </form>
        </div>
    );
}