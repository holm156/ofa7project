export const getImageUrl = (url: string | null | undefined, chapterId?: string): string => {
    if (!url) return '';
    
    const wasabiBase = "https://s3.eu-central-1.wasabisys.com/manhwa"; 
    const wasabiCdnUrl = process.env.NEXT_PUBLIC_WASABI_CDN || ''; 
    const generalCdnUrl = process.env.NEXT_PUBLIC_CDN_URL || '';

    // If the image is from Wasabi, convert it to Cloudflare CDN link immediately (to bypass proxy)
    if (url.startsWith(wasabiBase) && wasabiCdnUrl) {
        return url.replace(wasabiBase, wasabiCdnUrl);
    }

    // If the URL is already your CDN link, return it as is immediately
    if (wasabiCdnUrl && url.startsWith(wasabiCdnUrl)) {
        return url;
    }

    // If it's a remote URL and we have a chapterId (Fallback for other remote images)
    if (url.startsWith('http') && chapterId) {
        if (url.includes('X-Amz-Signature') || url.includes('AWSAccessKeyId')) {
            return url;
        }
        return `/api/image?url=${encodeURIComponent(url)}&chapterId=${chapterId}`;
    }

    // If it's already a full URL and no chapterId, return it
    if (url.startsWith('http')) return url;
    
    // Remove /api prefix if it exists (legacy path)
    let cleanPath = url.startsWith('/api/') ? url.substring(4) : url;
    
    // Ensure the path starts with a single /
    if (!cleanPath.startsWith('/')) {
        cleanPath = '/' + cleanPath;
    }
    
    // Return CDN URL + path, or just the relative path if CDN is not set
    return generalCdnUrl ? `${generalCdnUrl}${cleanPath}` : cleanPath;
};
