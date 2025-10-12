//lib/ShareCardArrays.jsx

/**
 * Factory functions that return translated ShareCard data
 * @param {Function} t - Translation function from useTranslation hook
 * @returns {Object} Object containing all translated arrays
 */
export const getShareCardData = (t) => {
    const homePage = [
        {
            icon: "https://linktree.sirv.com/Images/icons/svgexport-16.svg",
            title: t('shareCard.homePage.addSocials.title'),
            nextPage: "addSocials",
            topText: t('shareCard.homePage.addSocials.topText'),
            p: t('shareCard.homePage.addSocials.description'),
            banner: "",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/svgexport-18.svg",
            title: t('shareCard.homePage.shareTo.title'),
            nextPage: "ShareTo",
            topText: t('shareCard.homePage.shareTo.topText'),
            p: t('shareCard.homePage.shareTo.description'),
            banner: "",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/svgexport-19.svg",
            title: t('shareCard.homePage.qrCode.title'),
            nextPage: "myQRCode",
            topText: t('shareCard.homePage.qrCode.topText'),
            p: t('shareCard.homePage.qrCode.description'),
            banner: "",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/svgexport-20.svg",
            title: t('shareCard.homePage.openLinktree.title'),
            nextPage: "myLink",
            p: "",
            banner: "",
            arrowIcon: "https://linktree.sirv.com/Images/icons/svgexport-21.svg"
        },
    ];

    const addSocials = [
        {
            icon: "https://linktree.sirv.com/Images/icons/Snapchat%20logo.svg",
            title: t('shareCard.socials.snapchat'),
            nextPage: "snapchat",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/instagram%20logo.svg",
            title: t('shareCard.socials.instagram'),
            nextPage: "instagram",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/facebook%20logo.svg",
            title: t('shareCard.socials.facebookProfile'),
            nextPage: "facebookProfile",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/tiktok%20logo.svg",
            title: t('shareCard.socials.tiktokProfile'),
            nextPage: "tiktok",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/twitch%20logo.svg",
            title: t('shareCard.socials.twitchProfile'),
            nextPage: "Twitch",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/facebook%20logo.svg",
            title: t('shareCard.socials.facebookPage'),
            nextPage: "FacebookPage",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/youtube%20logo.svg",
            title: t('shareCard.socials.youtube'),
            nextPage: "Youtube",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/linkedin%20logo.svg",
            title: t('shareCard.socials.linkedin'),
            nextPage: "Linkedin",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/pinterest%20logo.svg",
            title: t('shareCard.socials.pinterest'),
            nextPage: "Pinterest",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/twitter%20logo.svg",
            title: t('shareCard.socials.twitter'),
            nextPage: "Twitter",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
    ];

    const ShareTo = [
        {
            icon: "https://linktree.sirv.com/Images/icons/Snapchat%20logo.svg",
            title: t('shareCard.shareTo.snapchat'),
            nextPage: "shareNow-Snapchat",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/facebook%20logo.svg",
            title: t('shareCard.shareTo.facebook'),
            nextPage: "shareNow-Facebook",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/linkedin%20logo.svg",
            title: t('shareCard.shareTo.linkedin'),
            nextPage: "shareNow-Linkedin",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/twitter%20logo.svg",
            title: t('shareCard.shareTo.twitter'),
            nextPage: "shareNow-Twitter",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/whatsapp%20logo.svg",
            title: t('shareCard.shareTo.whatsapp'),
            nextPage: "shareNow-WhatsApp",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/facebook%20messenger%20logo.svg",
            title: t('shareCard.shareTo.messenger'),
            nextPage: "shareNow-Messenger",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
        {
            icon: "https://linktree.sirv.com/Images/icons/email%20icon.svg",
            title: t('shareCard.shareTo.email'),
            nextPage: "shareNow-Email",
            arrowIcon: "https://linktree.sirv.com/Images/icons/arrow.svg"
        },
    ];

    const socialPage = [
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/snapchat.png",
            title: t('shareCard.socials.snapchat'),
            nextPage: "goTo-Snapchat",
            icon: "https://linktree.sirv.com/Images/icons/Snapchat%20logo.svg",
            description: t('shareCard.socialPage.snapchat.description'),
            externalShare: "www.snapchat.com"
        },
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/instagram.png",
            title: t('shareCard.socials.instagram'),
            nextPage: "goTo-Instagram",
            icon: "https://linktree.sirv.com/Images/icons/instagram%20logo.svg",
            description: t('shareCard.socialPage.instagram.description'),
            externalShare: "www.instagram.com/accounts/edit"
        },
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/facebook.png",
            title: t('shareCard.socials.facebook'),
            nextPage: "goTo-Facebook",
            icon: "https://linktree.sirv.com/Images/icons/facebook%20logo.svg",
            description: t('shareCard.socialPage.facebook.description'),
            externalShare: "www.facebook.com"
        },
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/tiktok.png",
            title: t('shareCard.socials.tiktok'),
            nextPage: "goTo-Tiktok",
            icon: "https://linktree.sirv.com/Images/icons/tiktok%20logo.svg",
            description: t('shareCard.socialPage.tiktok.description'),
            externalShare: "www.tiktok.com/"
        },
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/twitch.png",
            title: t('shareCard.socials.twitch'),
            nextPage: "goTo-Twitch",
            icon: "https://linktree.sirv.com/Images/icons/twitch%20logo.svg",
            description: t('shareCard.socialPage.twitch.description'),
            externalShare: "www.twitch.tv"
        },
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/facebook.png",
            title: t('shareCard.socials.facebookPage'),
            nextPage: "goTo-Facebook",
            icon: "https://linktree.sirv.com/Images/icons/facebook%20logo.svg",
            description: t('shareCard.socialPage.facebookPage.description'),
            externalShare: "www.facebook.com/"
        },
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/youtube.png",
            title: t('shareCard.socials.youtube'),
            nextPage: "goTo-Youtube",
            icon: "https://linktree.sirv.com/Images/icons/youtube%20logo.svg",
            description: t('shareCard.socialPage.youtube.description'),
            externalShare: "www.youtube.com"
        },
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/linkedin.png",
            title: t('shareCard.socials.linkedin'),
            nextPage: "goTo-Linkedin",
            icon: "https://linktree.sirv.com/Images/icons/linkedin%20logo.svg",
            description: t('shareCard.socialPage.linkedin.description'),
            externalShare: "www.linkedin.com"
        },
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/pinterest.png",
            title: t('shareCard.socials.pinterest'),
            nextPage: "goTo-Pinterest",
            icon: "https://linktree.sirv.com/Images/icons/pinterest%20logo.svg",
            description: t('shareCard.socialPage.pinterest.description'),
            externalShare: "https://pinterest.com/settings"
        },
        {
            bannerImg: "https://linktree.sirv.com/Images/icons/banners/twitter.png",
            title: t('shareCard.socials.twitter'),
            nextPage: "goTo-Twitter",
            icon: "https://linktree.sirv.com/Images/icons/twitter%20logo.svg",
            description: t('shareCard.socialPage.twitter.description'),
            externalShare: "https://twitter.com/settings/profile"
        },
    ];

    return { homePage, addSocials, ShareTo, socialPage };
};