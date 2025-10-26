// app/elements/LandingPage Elements/Form.jsx
"use client"
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import "../../styles/3d.css";
import "../../styles/modernLanding.css";
import { motion } from "framer-motion";
import { FaCheck, FaXmark, FaArrowRight, FaWifi, FaChartLine, FaLeaf } from "react-icons/fa6";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { useScrollAnimation } from "@/LocalHooks/useScrollAnimation";
import { useAuth } from "@/contexts/AuthContext";
import { AuthService } from "@/lib/services/client/authService.js";

// Import reusable components
import FloatingCard from "./FloatingCard";
import AnimatedStat from "./AnimatedStat";
import GradientButton from "./GradientButton";
import NFCDemoAnimation from "./NFCDemoAnimation";

export default function Form() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [hasError, setHasError] = useState(0); // 0: idle, 1: error, 2: success
    const [canProceed, setCanProceed] = useState(false);
    const [username, setUsername] = useState("");
    const router = useRouter();
    const [errorMessage, setErrorMessage] = useState("");
    const debouncedUsername = useDebounce(username, 800);

    // Scroll animation hooks for sections
    const socialProofSection = useScrollAnimation();
    const featuresSection = useScrollAnimation();

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            mainTitle: t('landing.hero.main_title') || "Transformez chaque poignée de main en connexion digitale",
            subtitle: t('landing.hero.subtitle') || "Fini les cartes perdues. Partagez votre profil professionnel d'un simple tap.",
            placeholder: t('landing.form.placeholder') || "votre-nom",
            ctaButton: t('landing.form.cta') || "C'est parti",
            getStartedButton: t('landing.form.get_started') || "C'est parti",
            usernameTaken: t('landing.form.errors.username_taken') || "Ce nom d'utilisateur est déjà pris",
            usernameTooShort: t('landing.form.errors.username_too_short') || "Le nom d'utilisateur doit contenir au moins 3 caractères",
            invalidFormat: t('landing.form.errors.invalid_format') || "Format invalide. Utilisez uniquement des lettres, chiffres, - et _",
            loadingAlt: t('common.loading') || "Chargement",
            usernameAvailable: t('landing.form.success.available') || "Disponible !",
            // Social proof section
            socialProofTitle: t('landing.social_proof.title') || "Comment ça marche ?",
            socialProofSubtitle: t('landing.social_proof.subtitle') || "Un simple tap suffit pour partager votre profil professionnel complet",
            statsEntrepreneurs: t('landing.stats.entrepreneurs') || "Entrepreneurs",
            statsCards: t('landing.stats.cards_distributed') || "Cartes distribuées",
            statsTime: t('landing.stats.time_to_share') || "Pour partager",
            // Features section
            featuresTitle: t('landing.features.title') || "Pourquoi Tapit ?",
            featuresSubtitle: t('landing.features.subtitle') || "La solution complète pour moderniser votre networking professionnel",
            featureNfcTitle: t('landing.features.nfc.title') || "Tap & Share",
            featureNfcDescription: t('landing.features.nfc.description') || "Partagez votre profil instantanément via NFC. Fini les cartes perdues et les contacts mal saisis.",
            featureAnalyticsTitle: t('landing.features.analytics.title') || "Analytics en temps réel",
            featureAnalyticsDescription: t('landing.features.analytics.description') || "Suivez vos connexions, analysez vos statistiques et optimisez votre networking.",
            featureEcoTitle: t('landing.features.eco.title') || "100% Eco-Friendly",
            featureEcoDescription: t('landing.features.eco.description') || "Dites adieu aux cartes papier jetables. Une seule carte NFC pour toute votre carrière.",
            // Testimonial
            testimonialQuote: t('landing.testimonial.quote') || "Depuis que j'utilise Tapit, j'ai multiplié mes connexions par 3 et je ne perds plus jamais un contact.",
            testimonialAuthor: t('landing.testimonial.author') || "Marie D., Entrepreneure Tech, Grenoble",
            testimonialCta: t('landing.testimonial.cta') || "Créer mon profil gratuitement",
            // Trust badges
            trustFree: t('landing.trust.free') || "Gratuit",
            trustRgpd: t('landing.trust.rgpd') || "RGPD Compliant",
            trustMadeIn: t('landing.trust.made_in') || "Made in Grenoble",
        };
    }, [t, isInitialized]);

    // Redirect if user is already logged in
    useEffect(() => {
        if (currentUser) {
            router.push("/dashboard");
        }
    }, [currentUser, router]);

    // Username validation logic - using API like LoginForm
    useEffect(() => {
        const validate = async () => {
            if (debouncedUsername === "") {
                setHasError(0);
                setCanProceed(false);
                setErrorMessage("");
                return;
            }

            if (debouncedUsername.length < 3) {
                setHasError(1);
                setCanProceed(false);
                setErrorMessage(translations.usernameTooShort);
                return;
            }

            if (/[^a-zA-Z0-9\-_]/.test(debouncedUsername)) {
                setHasError(1);
                setCanProceed(false);
                setErrorMessage(translations.invalidFormat);
                return;
            }

            setIsCheckingUsername(true);
            setErrorMessage("");

            try {
                const result = await AuthService.validateUsername(debouncedUsername);

                // For landing page: available = !exists (opposite of login)
                if (!result.exists) {
                    setHasError(2); // Success - username is available
                    setCanProceed(true);
                    setErrorMessage("");
                } else {
                    setHasError(1); // Error - username already taken
                    setCanProceed(false);
                    setErrorMessage(translations.usernameTaken);
                }
            } catch (error) {
                setHasError(1);
                setCanProceed(false);
                setErrorMessage(error.message || "Unable to validate username");
            } finally {
                setIsCheckingUsername(false);
            }
        };

        validate();
    }, [debouncedUsername, translations]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (canProceed && !isLoading) {
            setIsLoading(true);
            localStorage.setItem("pendingUsername", username);
            router.push("/signup");
            setCanProceed(false);
        }
    }

    // 3D Animation Effect for hero section
    useEffect(() => {
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
            // Don't update 3D effect if hovering over input elements
            if (event.target.tagName === 'INPUT' ||
                event.target.tagName === 'BUTTON' ||
                event.target.closest('#input')) {
                return;
            }

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
            // Don't apply 3D transform to input - it breaks interactivity
            // inputDiv.style.transform = `translateZ(60px)`;
        };

        container.addEventListener('mouseenter', onMouseEnterHandler);
        container.addEventListener('mouseleave', onMouseLeaveHandler);
        container.addEventListener('mousemove', onMouseMoveHandler);

        // Cleanup function
        return () => {
            if (container) {
                container.removeEventListener('mouseenter', onMouseEnterHandler);
                container.removeEventListener('mouseleave', onMouseLeaveHandler);
                container.removeEventListener('mousemove', onMouseMoveHandler);
            }
        };
    }, []);

    // Don't render if user is already logged in
    if (currentUser) {
        return null;
    }

    // Loading state for translations
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
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 pt-24 sm:pt-28 md:pt-32 pb-12 space-y-24">

            {/* ========================================
                HERO SECTION - Main value proposition
                ======================================== */}
            <div className="w-fit mx-auto" id="container">
                <div className="flex items-center justify-center flex-col" id="inner">

                    {/* Hero Title - Punchy and clear */}
                    <motion.h1
                        initial={{ opacity: 0, y: -30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white z-10 mb-6 max-w-4xl text-center leading-tight"
                    >
                        <span className="gradient-text animate-shimmer">
                            {translations.mainTitle}
                        </span>
                    </motion.h1>

                    {/* Subtitle - Solving pain point */}
                    <motion.p
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className="max-w-2xl text-center font-medium text-base sm:text-lg md:text-xl opacity-90 z-10 text-white mb-12"
                    >
                        {translations.subtitle}
                    </motion.p>

                    {/* Username Input Form with 3D effect - BIGGER & BOLDER */}
                    <motion.form
                        onSubmit={handleSubmit}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                        onAnimationComplete={() => {
                            // Ensure input is focusable after animation
                            const input = document.querySelector('#input input[type="text"]');
                            if (input) {
                                input.style.pointerEvents = 'auto';
                            }
                        }}
                        className="w-full max-w-4xl"
                        id="input"
                        style={{ pointerEvents: 'auto' }}
                    >
                        <div className="flex flex-col gap-6">
                            {/* Input container with glassmorphism - LARGER */}
                            <div className={`flex items-stretch gap-0 rounded-2xl overflow-hidden transition-all duration-300 shadow-2xl ${
                                hasError === 1 ? "animate-error-shake ring-4 ring-red-500/50" :
                                hasError === 2 ? "animate-success-bounce ring-4 ring-themeGreen/50" :
                                "ring-2 ring-white/20"
                            }`}>
                                {/* URL prefix label - BIGGER */}
                                <div className={`flex items-center bg-white/95 backdrop-blur-xl px-6 sm:px-8 py-7 sm:py-8 md:py-10 text-base sm:text-xl md:text-2xl lg:text-3xl transition-colors duration-300 ${
                                    hasError === 2 ? "bg-themeGreen/10" : ""
                                }`}>
                                    <label className="opacity-40 font-bold whitespace-nowrap">tapit.fr/</label>
                                </div>

                                {/* Username input - BIGGER */}
                                <div className="flex items-center flex-1 bg-white/95 backdrop-blur-xl py-7 sm:py-8 md:py-10">
                                    <input
                                        type="text"
                                        className="bg-transparent px-4 sm:px-6 outline-none border-none flex-1 text-base sm:text-xl md:text-2xl lg:text-3xl font-semibold text-gray-800 placeholder:text-gray-400 input-focus-glow transition-all duration-300"
                                        placeholder={translations.placeholder}
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        aria-label="Nom d'utilisateur"
                                        aria-invalid={hasError === 1}
                                        aria-describedby={hasError === 1 ? "error-message" : undefined}
                                        style={{ pointerEvents: 'auto' }}
                                        autoComplete="off"
                                    />
                                    {/* Validation status indicator - BIGGER */}
                                    <div className="px-4 sm:px-6">
                                        {isCheckingUsername ? (
                                            <svg className="animate-spin h-6 w-6 sm:h-7 sm:w-7 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : hasError === 2 && username !== "" ? (
                                            <FaCheck className="text-themeGreen h-6 w-6 sm:h-7 sm:w-7" />
                                        ) : hasError === 1 && username !== "" ? (
                                            <FaXmark className="text-red-500 h-6 w-6 sm:h-7 sm:w-7" />
                                        ) : null}
                                    </div>
                                </div>

                                {/* Submit button - BIGGER & MORE PROMINENT */}
                                <button
                                    type="submit"
                                    disabled={!canProceed || isLoading}
                                    className={`px-10 sm:px-14 md:px-20 lg:px-24 py-7 sm:py-8 md:py-10 flex items-center justify-center font-bold text-white transition-all duration-300 flex-shrink-0 ${
                                        canProceed && !isLoading
                                            ? "bg-gradient-to-r from-themeGreen to-blue-500 hover:from-themeGreen hover:to-purple-600 cursor-pointer hover:shadow-2xl hover:shadow-themeGreen/50"
                                            : "bg-gray-400 cursor-not-allowed"
                                    }`}
                                    aria-label={canProceed ? "Continuer vers l'inscription" : "Veuillez entrer un nom d'utilisateur valide"}
                                >
                                    {isLoading ? (
                                        <svg className="animate-spin h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <FaArrowRight className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />
                                    )}
                                </button>
                            </div>

                            {/* Status messages */}
                            <div className="min-h-[2rem] px-2">
                                {hasError === 1 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        id="error-message"
                                        className="flex items-center gap-2 text-red-400 text-sm font-medium"
                                        role="alert"
                                    >
                                        <FaXmark className="flex-shrink-0" />
                                        <span>{errorMessage}</span>
                                    </motion.div>
                                )}
                                {hasError === 2 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 text-themeGreen text-sm font-medium"
                                        role="status"
                                    >
                                        <FaCheck className="flex-shrink-0" />
                                        <span>{translations.usernameAvailable}</span>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.form>

                    {/* Trust indicators mini badges */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="flex flex-wrap items-center justify-center gap-4 mt-8 text-xs sm:text-sm text-white/60"
                    >
                        <div className="flex items-center gap-2">
                            <FaCheck className="text-themeGreen" />
                            <span>{translations.trustFree}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FaCheck className="text-themeGreen" />
                            <span>{translations.trustRgpd}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FaCheck className="text-themeGreen" />
                            <span>{translations.trustMadeIn}</span>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ========================================
                SOCIAL PROOF SECTION - Stats & Demo
                ======================================== */}
            <motion.section
                ref={socialProofSection.ref}
                initial={{ opacity: 0, y: 50 }}
                animate={socialProofSection.inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                transition={{ duration: 0.8 }}
                className="space-y-16"
            >
                {/* Animated statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
                    <AnimatedStat value={500} suffix="+" label={translations.statsEntrepreneurs} delay={0} />
                    <AnimatedStat value={10} suffix="k+" label={translations.statsCards} delay={0.2} />
                    <AnimatedStat value={5} suffix=" sec" label={translations.statsTime} delay={0.4} />
                </div>

                {/* Visual demo animation */}
                <div className="glass-strong rounded-3xl p-8 sm:p-12">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white text-center mb-4">
                        {translations.socialProofTitle}
                    </h3>
                    <p className="text-white/70 text-center mb-8 max-w-2xl mx-auto">
                        {translations.socialProofSubtitle}
                    </p>
                    <NFCDemoAnimation />
                </div>
            </motion.section>

            {/* ========================================
                FEATURE HIGHLIGHTS - 3 Key Features
                ======================================== */}
            <motion.section
                ref={featuresSection.ref}
                initial={{ opacity: 0, y: 50 }}
                animate={featuresSection.inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                transition={{ duration: 0.8 }}
                className="space-y-8"
            >
                <div className="text-center mb-12">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                        {translations.featuresTitle}
                    </h2>
                    <p className="text-white/70 text-lg max-w-2xl mx-auto">
                        {translations.featuresSubtitle}
                    </p>
                </div>

                {/* Feature cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                    <FloatingCard
                        icon={FaWifi}
                        title={translations.featureNfcTitle}
                        description={translations.featureNfcDescription}
                        delay={0}
                    />
                    <FloatingCard
                        icon={FaChartLine}
                        title={translations.featureAnalyticsTitle}
                        description={translations.featureAnalyticsDescription}
                        delay={0.2}
                    />
                    <FloatingCard
                        icon={FaLeaf}
                        title={translations.featureEcoTitle}
                        description={translations.featureEcoDescription}
                        delay={0.4}
                    />
                </div>
            </motion.section>

            {/* ========================================
                TESTIMONIAL / FINAL CTA Section
                ======================================== */}
            <motion.section
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="glass-strong rounded-3xl p-8 sm:p-12 text-center space-y-6"
            >
                <div className="max-w-3xl mx-auto">
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 leading-relaxed">
                        &ldquo;{translations.testimonialQuote}&rdquo;
                    </p>
                    <p className="text-white/70 mb-8">
                        — {translations.testimonialAuthor}
                    </p>

                    <GradientButton
                        onClick={() => {
                            const input = document.querySelector('input[type="text"]');
                            if (input) {
                                input.focus();
                                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }}
                        className="mx-auto"
                    >
                        {translations.testimonialCta}
                    </GradientButton>
                </div>
            </motion.section>

        </div>
    );
}