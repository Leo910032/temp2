"use client"
import { useContext, useState, useRef, useEffect } from "react";
import { ShareContext } from "../ShareCard";
import Link from "next/link";
import { 
    FacebookShareButton, 
    LinkedinShareButton, 
    TwitterShareButton, 
    WhatsappShareButton, 
    FacebookMessengerShareButton, 
    EmailShareButton,
} from "react-share";
import { makeValidUrl } from "@/lib/utilities";

export default function ShareLiElement({children, nextPage }) {
    const shareContext = useContext(ShareContext);
    const { myLink, setCurrentPage } = shareContext || {};
    const [linkToOpen, setLinkToOpen] = useState("");
    const FacebookRef = useRef();
    const LinkedinRef = useRef();
    const TwitterRef = useRef();
    const WhatsAppRef = useRef();
    const MessengerRef = useRef();
    const EmailRef = useRef();

    const openLinkInNewTab = (url) => {
        setLinkToOpen(url);
    };

    const handleNextPage = (e) => {
        // Stop event from bubbling up to parent elements
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) {
            e.stopImmediatePropagation();
        }
        
        // ✅ IMPROVED: Better validation with more descriptive warnings
        if (!myLink) {
            console.warn("⚠️ ShareLiElement: myLink is not available, cannot proceed with share action");
            return;
        }
        
        if (!setCurrentPage) {
            console.warn("⚠️ ShareLiElement: setCurrentPage function is not available from ShareContext");
            return;
        }
        
        // Handle shareNow- prefixed actions
        if (typeof nextPage === 'string' && nextPage.includes("shareNow-")) {
            const shareTo = nextPage.split("-")[1];
            
            switch (shareTo) {
                case "Snapchat":
                    openLinkInNewTab(`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(myLink)}`);
                    break;
                case "Facebook":
                    if (FacebookRef.current) {
                        FacebookRef.current.click();
                    }
                    break;
                case "Linkedin":
                    if (LinkedinRef.current) {
                        LinkedinRef.current.click();
                    }
                    break;
                case "Twitter":
                    if (TwitterRef.current) {
                        TwitterRef.current.click();
                    }
                    break;
                case "WhatsApp":
                    if (WhatsAppRef.current) {
                        WhatsAppRef.current.click();
                    }
                    break;
                case "Messenger":
                    if (MessengerRef.current) {
                        MessengerRef.current.click();
                    }
                    break;
                case "Email":
                    if (EmailRef.current) {
                        EmailRef.current.click();
                    }
                    break;
                default:
                    console.warn(`⚠️ ShareLiElement: Unknown share target: ${shareTo}`);
                    break;
            }
            return;
        }
        
        if (nextPage && typeof nextPage === 'object' && nextPage.type && nextPage.type.includes("goTo-")) {
            openLinkInNewTab(makeValidUrl(nextPage.goTo));
            return;
        }

        if (nextPage === "myLink") {
            openLinkInNewTab(myLink);
            return;
        }

        // ✅ IMPROVED: Better error handling for page navigation
        try {
            setCurrentPage((previousPages) => [...previousPages, { page: nextPage }]);
        } catch (error) {
            console.error("❌ ShareLiElement: Error updating currentPage:", error);
        }
    };

    useEffect(() => {
        if (linkToOpen) {
            // Use window.open instead of clicking a Link element for more reliable behavior
            const newWindow = window.open(linkToOpen, '_blank', 'noopener,noreferrer');
            if (newWindow) {
                newWindow.focus();
            } else {
                // Fallback: Create a temporary link element
                const tempLink = document.createElement('a');
                tempLink.href = linkToOpen;
                tempLink.target = '_blank';
                tempLink.rel = 'noopener noreferrer';
                document.body.appendChild(tempLink);
                tempLink.click();
                document.body.removeChild(tempLink);
            }
            setLinkToOpen("");
        }
    }, [linkToOpen]);

    // ✅ IMPROVED: Don't render if essential data is missing
    if (!shareContext || !myLink) {
        return null;
    }

    return (
        <div
            className="w-full flex justify-between items-center p-3 rounded-xl select-none hover:bg-black hover:bg-opacity-5 cursor-pointer active:scale-95"
            onClick={handleNextPage}
        >
            {children}
            
            <section className="hidden">
                <FacebookShareButton ref={FacebookRef} url={myLink} quote="Check out my Linktree!">
                    <div>Facebook Share</div>
                </FacebookShareButton>
                <LinkedinShareButton ref={LinkedinRef} url={myLink} title="Check out my Linktree!">
                    <div>LinkedIn Share</div>
                </LinkedinShareButton>
                <TwitterShareButton ref={TwitterRef} url={myLink} title="Check out my Linktree!">
                    <div>Twitter Share</div>
                </TwitterShareButton>
                <WhatsappShareButton ref={WhatsAppRef} url={myLink} title="Check out my Linktree!">
                    <div>WhatsApp Share</div>
                </WhatsappShareButton>
                <FacebookMessengerShareButton ref={MessengerRef} url={myLink} appId="123456789">
                    <div>Messenger Share</div>
                </FacebookMessengerShareButton>
                <EmailShareButton ref={EmailRef} url={myLink} subject="Check out my Linktree!" body="Here's my Linktree: ">
                    <div>Email Share</div>
                </EmailShareButton>
            </section>
        </div>
    );
}