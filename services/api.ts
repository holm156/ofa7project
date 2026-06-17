import { Manga, Chapter, Comment, User } from '../types';

const API_BASE = ''; // Same origin

// --- API Methods ---

export const api = {
    // Mangas
    getMangas: async (params?: { ids?: string[] }): Promise<Manga[]> => {
        let url = '/api/manga';
        if (params?.ids && params.ids.length > 0) {
            url += `?ids=${params.ids.join(',')}`;
        }
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    },

    getChapters: async (mangaId?: string): Promise<Chapter[]> => {
        const url = mangaId ? `/api/chapter?mangaId=${mangaId}` : '/api/chapter';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch chapters');
        return res.json();
    },

    getComments: async (mangaId: string, sort: string = 'newest', chapterId?: string): Promise<Comment[]> => {
        let url = `/api/manga/${mangaId}/comment?sort=${sort}`;
        if (chapterId) url += `&chapterId=${chapterId}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch comments');
        return res.json();
    },

    getReplies: async (mangaId: string, parentId: string): Promise<Comment[]> => {
        const res = await fetch(`/api/manga/${mangaId}/comment/replies?parentId=${parentId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch replies');
        return res.json();
    },

    addComment: async (mangaId: string, content: string, parentId?: string, chapterId?: string): Promise<Comment | null> => {
        const res = await fetch(`/api/manga/${mangaId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, parentId, chapterId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to post comment');
        return data;
    },

    voteComment: async (commentId: string, type: 1 | -1 | 0): Promise<{ likes: number; dislikes: number; userVote: number }> => {
        const res = await fetch(`/api/comments/${commentId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Vote failed');
        return data;
    },

    deleteComment: async (commentId: string): Promise<any> => {
        const res = await fetch(`/api/comments/${commentId}`, {
            method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        return data;
    },

    // User & Profile
    getUserProfile: async (userId: string): Promise<User | null> => {
        const res = await fetch('/api/user/profile', { cache: 'no-store' });
        if (res.status === 401 || !res.ok) return null;
        return res.json();
    },

    updateUserProfile: async (userId: string, updates: Partial<any>) => {
        const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Update failed');
    },

    unlockChapter: async (chapterId: string, price: number) => {
        const res = await fetch('/api/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterId, price })
        });
        return res.json();
    },

    // Auth
    register: async (username: string, email: string, password: string): Promise<any> => {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        return data;
    },

    // Interactions
    updateMangaRating: async (mangaId: string, rating: number): Promise<number> => {
        const res = await fetch(`/api/manga/${mangaId}/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Rating failed');
        return data.rating;
    },

    incrementViews: async (mangaId: string) => {
        await fetch(`/api/manga/${mangaId}/view`, { method: 'POST' });
    },

    // Admin / CMS
    createManga: async (mangaData: any): Promise<Manga | null> => {
        const res = await fetch('/api/manga', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mangaData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create manga');
        return data;
    },

    updateManga: async (id: string, mangaData: any): Promise<Manga> => {
        const res = await fetch(`/api/manga/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mangaData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');
        return data;
    },

    deleteManga: async (id: string) => {
        const res = await fetch(`/api/manga/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
    },

    createChapter: async (chapterData: any): Promise<Chapter | null> => {
        const res = await fetch('/api/chapter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chapterData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create chapter');
        return data;
    },

    updateChapter: async (id: string, chapterData: any): Promise<Chapter> => {
        const res = await fetch(`/api/chapter/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chapterData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');
        return data;
    },

    deleteChapter: async (id: string) => {
        const res = await fetch(`/api/chapter/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
    },

    // Storage
    uploadFile: async (path: string, file: File): Promise<string[]> => {
        const formData = new FormData();
        formData.append('file', file);
        const folder = path;
        formData.append('folder', folder);

        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        // Handle both the new 'urls' array format and the old 'url' format for backward compatibility
        if (data.urls && Array.isArray(data.urls)) {
            return data.urls;
        }
        return data.url ? [data.url] : [];
    },

    deleteFile: async (url: string) => {
        const res = await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        return data;
    },

    // Promo Codes
    claimPromoCode: async (code: string): Promise<any> => {
        const res = await fetch('/api/promo/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Claim failed');
        return data;
    },

    getAdminPromoCodes: async (): Promise<any[]> => {
        const res = await fetch('/api/admin/promo', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch promo codes');
        return res.json();
    },

    createPromoCode: async (promoData: any): Promise<any> => {
        const res = await fetch('/api/admin/promo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(promoData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create promo code');
        return data;
    },

    deletePromoCode: async (id: string): Promise<any> => {
        const res = await fetch(`/api/admin/promo/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        return res.json();
    },

    // Notifications
    syncNotificationState: async (notifId: string, updates: { isRead?: boolean; isCleared?: boolean }) => {
        const res = await fetch('/api/user/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notifId, ...updates }),
        });
        return res.json();
    },

    getNotificationStates: async () => {
        const res = await fetch('/api/user/notifications');
        if (!res.ok) return [];
        return res.json();
    }
};
