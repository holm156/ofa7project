"use client";
import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
    slotId: string;
    adKey?: string;
    width?: number;
    height?: number;
    label?: string;
    className?: string;
}

const ENABLE_ADS = false; // Toggle to easily turn ads on/off site-wide

/**
 * AdBanner Component - Updated for ExoClick ads.
 */
export const AdBanner: React.FC<AdBannerProps> = ({
    slotId,
    adKey,
    width = 728,
    height = 90,
    label,
    className = ""
}) => {
    const adRef = useRef<HTMLDivElement>(null);
    // Use the provided zoneId from adKey or fall back to the default one provided by user
    const zoneId = adKey || '5905012';

    useEffect(() => {
        if (!ENABLE_ADS) return;
        
        if (typeof window !== "undefined" && adRef.current) {
            // Clear previous content
            adRef.current.innerHTML = '';

            // Create an isolated iframe to prevent conflicts
            const iframe = document.createElement("iframe");
            iframe.width = width.toString();
            iframe.height = height.toString();
            iframe.style.border = "none";
            iframe.style.overflow = "hidden";
            iframe.style.maxWidth = "100%";
            iframe.scrolling = "no";

            adRef.current.appendChild(iframe);

            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(`
                    <html>
                        <body style="margin:0;padding:0;background:transparent;">
                            <!-- Banner ad content goes here -->
                        </body>
                    </html>
                `);
                doc.close();
            }
        }
    }, [slotId, zoneId, width, height]);

    if (!ENABLE_ADS) return null;

    return (
        <div className={`ad-container w-full flex flex-col items-center my-6 ${className}`}>
            <div
                ref={adRef}
                id={`ad-slot-${slotId}`}
                style={{ minHeight: height, maxWidth: width }}
                className="w-full flex items-center justify-center overflow-hidden bg-zinc-900/5 rounded"
            />
        </div>
    );
};
