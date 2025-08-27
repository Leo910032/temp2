// lib/SupportGroups.jsx - Fixed Import Path
"use client"
import { useTranslation } from "./translation/useTranslation"; // FIXED IMPORT PATH

// Static data that doesn't change (URLs and type)
const staticSupportGroupsData = [
    {
        type: 0,
        linkTo: "https://github.com/fabiconcept",
    },
    {
        type: 1,
        linkTo: "https://mylinks.fabiconcept.online/freepalestine"
    },
    {
        type: 2,
        linkTo: "https://linktr.ee/withukraine",
    },
    {
        type: 3,
        linkTo: "https://linktr.ee/ACTION",
    },
    {
        type: 4,
        linkTo: "https://linktr.ee/PrideMonth",
    },
];

// Hook to get translated support groups
export const useTranslatedSupportGroups = () => {
    const { t, isInitialized } = useTranslation();

    if (!isInitialized) {
        // Return fallback data while translations load
        return staticSupportGroupsData.map((group, index) => ({
            ...group,
            caption: `Support Group ${index}`,
            cardTitle: "Loading...",
            cardMessage: "Loading...",
            title: "Loading...",
            message: "Loading...",
        }));
    }

    return staticSupportGroupsData.map((group) => ({
        ...group,
        caption: t(`dashboard.settings.support_banner.causes.${group.type}.caption`),
        cardTitle: t(`dashboard.settings.support_banner.causes.${group.type}.card_title`),
        cardMessage: t(`dashboard.settings.support_banner.causes.${group.type}.card_message`),
        title: t(`dashboard.settings.support_banner.causes.${group.type}.banner_title`),
        message: t(`dashboard.settings.support_banner.causes.${group.type}.banner_message`),
    }));
};

// For backward compatibility - export the static array (keep your existing export)
export const SupportGroups = [
    {
        type: 0,
        caption:'Support Creator',
        cardTitle: "Explore more of my Projects.",
        cardMessage: "Take a look at my projects and the things I've added to GitHub. You'll find a mix of different stuff I've worked on, and I'm excited to share them with you!",
        title: "Discover My GitHub Projects",
        message: "I invite you to explore my GitHub profile, where you can find an array of exciting projects and contributions. Feel free to take a look, and if you find something you like, don't hesitate to show your support by leaving a star ⭐",
        linkTo: "https://github.com/fabiconcept",
    },
    {
        type: 1,
        caption: "#FreePalestine",
        cardTitle: "War is never the answer.",
        cardMessage: "Display a support banner to encourage your visitors to #FreePalestine, donate and discover resources, and support the right for people everywhere to live in peace.",
        title: "War is not the answer.",
        message: "I'm driving awareness, donations, and support to #FreePalestine, and the right for people everywhere to live in peace. Will you join me?",
        linkTo: "https://mylinks.fabiconcept.online/freepalestine"
    },
    {
        type: 2,
        caption:'#StandWithUkraine',
        cardTitle: "War is never the answer.",
        cardMessage: "Display a support banner to encourage your visitors to #StandWithUkraine, donate and discover resources, and support the right for people everywhere to live in peace.",
        title: "War is not the answer.",
        message: "I'm driving awareness, donations and support to #StandWithUkraine, and the right for people everywhere to live in peace. Will you join me?",
        linkTo: "https://linktr.ee/withukraine",
    },
    {
        type: 3,
        caption:'Anti-Racism',
        cardTitle: "Racism is an international emergency.",
        cardMessage: "Display a support banner on your Linktree allowing your visitors to donate and discover resources in support of anti-racism, justice and equality.",
        title: "Support Anti-Racism",
        message: "I'm raising awareness, driving donations and sharing information in support of racial justice and equality. Will you join me?",
        linkTo: "https://linktr.ee/ACTION",
    },
    {
        type: 4,
        caption:'Pride',
        cardTitle: "Support the LGBTQIA+ community",
        cardMessage: "Display a support banner to raise awareness and funds for the LGBTQIA+ community during Pride month.",
        title: "Protect LGBTQIA+ rights",
        message: "In celebration of Pride, I'm raising awareness and funds to support the LGBTQIA+ community. Join me.",
        linkTo: "https://linktr.ee/PrideMonth",
    },
];