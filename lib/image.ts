export const getImageUrl = (url: string | null | undefined, chapterId?: string): string => {
    if (!url) return '';
    
    const wasabiBase = "https://s3.eu-central-1.wasabisys.com/manhwa"; 
    const wasabiCdnUrl = process.env.NEXT_PUBLIC_WASABI_CDN || ''; 
    const generalCdnUrl = process.env.NEXT_PUBLIC_CDN_URL || '';

    // لو الصورة من Wasabi، حولها فوراً لرابط كلاود فلير ورجعها فوراً (عشان ما تروحش للـ Proxy)
    if (url.startsWith(wasabiBase) && wasabiCdnUrl) {
        return url.replace(wasabiBase, wasabiCdnUrl);
    }

    // لو الرابط أصلاً هو رابط الـ CDN بتاعك، رجعه زي ما هو فوراً
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
