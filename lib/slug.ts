export function slugify(text: string): string {
    if (!text) return generateRandomSlug(10);
    
    let res = text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        // Allow alphanumeric, Arabic characters (\u0600-\u06FF), and hyphens
        .replace(/[^\w\u0600-\u06FF-]+/g, '') 
        .replace(/--+/g, '-')     // Replace multiple - with single -
        .replace(/^-+/, '')       // Trim - from start of text
        .replace(/-+$/, '');      // Trim - from end of text
        
    return res || generateRandomSlug(10);
}

export function generateSlug(title: string): string {
    return slugify(title);
}

export function generateRandomSlug(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
