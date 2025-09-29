// 1. First, let's update the Preview component to better handle gradients
// File: app/dashboard/general components/Preview.jsx

"use client"
import Image from 'next/image';
import { useEffect, useState, useContext } from 'react';
import "../../styles/3d.css";
import { useAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { fireApp } from '@/important/firebase';

export default function Preview() {
    const { currentUser } = useAuth();
    const [username, setUsername] = useState("");
    const [userAppearance, setUserAppearance] = useState(null);

    // Listen to user data changes including appearance
    useEffect(() => {
        if (!currentUser) {
            setUsername("");
            setUserAppearance(null);
            return;
        }

        console.log('🔍 Preview: Setting up listener for user:', currentUser.uid);
        
        const docRef = doc(fireApp, "users", currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const fetchedUsername = userData?.username || "";
                const appearance = userData?.appearance || {};
                
                console.log('📱 Preview: User data fetched:', { fetchedUsername, appearance });
                setUsername(fetchedUsername);
                setUserAppearance(appearance);
                
                // Force iframe reload when appearance changes
                const iframe = document.getElementById('preview-iframe');
                if (iframe && fetchedUsername) {
                    // Add timestamp to force reload
                    iframe.src = `/${fetchedUsername}?preview=true&t=${Date.now()}`;
                }
            } else {
                console.warn('⚠️ Preview: User document not found');
                setUsername("");
                setUserAppearance(null);
            }
        }, (error) => {
            console.error('❌ Preview: Error listening to user document:', error);
            setUsername("");
            setUserAppearance(null);
        });

        return () => {
            console.log('🧹 Preview: Cleaning up listener');
            unsubscribe();
        };
    }, [currentUser]);

    // Generate preview background style
    const getPreviewBackgroundStyle = () => {
        if (!userAppearance) return {};

        const { 
            backgroundType, 
            backgroundColor, 
            gradientDirection, 
            gradientColorStart, 
            gradientColorEnd 
        } = userAppearance;

        switch (backgroundType) {
            case 'Gradient':
                const direction = gradientDirection === 1 ? 'to top' : 'to bottom';
                return {
                    background: `linear-gradient(${direction}, ${gradientColorStart || '#FFFFFF'}, ${gradientColorEnd || '#000000'})`
                };
            case 'Color':
                return {
                    backgroundColor: backgroundColor || '#FFFFFF'
                };
            default:
                return {
                    backgroundColor: '#FFFFFF'
                };
        }
    };
    
    // 3D tilt effect (keeping existing code)
    useEffect(() => {
        const container = document.getElementById("container");
        const inner = document.getElementById("inner");
        if (!container || !inner) return;

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
            }
        };

        mouse.setOrigin(container);
        let counter = 0;
        const updateRate = 10;

        const onMouseEnterHandler = function (event) {
            update(event);
        };

        const onMouseLeaveHandler = function () {
            inner.style = "";
        };

        const onMouseMoveHandler = function (event) {
            if (counter++ % updateRate === 0) {
                update(event);
            }
        };

        const update = function (event) {
            mouse.updatePosition(event);
            const x = (mouse.y / inner.offsetHeight / 2).toFixed(2);
            const y = (mouse.x / inner.offsetWidth / 2).toFixed(2);
            const style = `rotateX(${x}deg) rotateY(${y}deg) scale(0.8)`;
            inner.style.transform = style;
        };

        container.onmouseenter = onMouseEnterHandler;
        container.onmouseleave = onMouseLeaveHandler;
        container.onmousemove = onMouseMoveHandler;

        return () => {
            container.onmouseenter = null;
            container.onmouseleave = null;
            container.onmousemove = null;
        };
    }, []);

    return (
        <div className="w-[35rem] md:grid hidden place-items-center border-l ml-4">
            <div className='w-fit h-fit' id='container'>
                <div className="h-[45rem] scale-[0.8] w-[23rem] bg-black rounded-[3rem] grid place-items-center" id="inner">
                    <div className="h-[97.5%] w-[95%] bg-white bg-opacity-[.1] grid place-items-center rounded-[2.5rem] overflow-hidden relative border">
                        <div className='absolute h-[20px] w-[20px] rounded-full top-2 bg-black'></div>
                        <div className='top-6 left-6 absolute pointer-events-none'>
                            <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt="loading" className="mix-blend-screen" />
                        </div>
                        <div className="h-full w-full">
                            {username ? (
                                <iframe
                                    id="preview-iframe"
                                    src={`/${username}?preview=true`}
                                    frameBorder="0"
                                    className='h-full w-full'
                                    style={getPreviewBackgroundStyle()}
                                    title="User Profile Preview"
                                    onLoad={() => console.log('🎯 Preview iframe loaded for:', username)}
                                    onError={() => console.error('❌ Preview iframe failed to load for:', username)}
                                ></iframe>
                            ) : (
                                <div 
                                    className="h-full w-full flex items-center justify-center"
                                    style={getPreviewBackgroundStyle()}
                                >
                                    <div className="text-center p-4">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                                        <p className="text-gray-600 text-sm">Loading preview...</p>
                                        {!currentUser && <p className="text-red-500 text-xs mt-1">No user logged in</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


