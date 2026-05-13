"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '../types';
import { useToast } from './ToastContext';
import { api } from '../services/api';
import { signIn, signOut } from 'next-auth/react';
import { generateRandomSlug } from '../lib/slug';

interface StoreContextType {
    currentUser: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    toggleBookmark: (mangaId: string) => Promise<void>;
    addToHistory: (mangaId: string, chapterId: string) => Promise<void>;
    rateManga: (mangaId: string, rating: number) => Promise<void>;
    addComment: (mangaId: string, content: string) => Promise<any>;
    incrementMangaView: (mangaId: string) => Promise<void>;
    unlockChapter: (chapterId: string, price: number) => Promise<boolean>;
    earnCoins: (amount: number) => Promise<void>;
    uploadChapterImages: (files: File[], mangaId: string, mangaTitle: string, chapterNumber: number) => Promise<string[]>;
    uploadSingleImage: (file: File, folder: string) => Promise<string | null>;
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearNotification: (id: string) => void;
    clearAllNotifications: () => void;
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
}

export interface Notification {
    id: string;
    type: 'chapter' | 'reply' | 'like';
    title: string;
    message: string;
    mangaId?: string;
    chapterNumber?: number;
    cover?: string;
    timestamp: string;
    isRead: boolean;
    user?: string;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { showToast } = useToast();

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [clearedNotifications, setClearedNotifications] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved === 'true') setIsSidebarCollapsed(true);
    }, []);

    const toggleSidebar = useCallback(() => {
        setIsSidebarCollapsed(prev => {
            const newVal = !prev;
            localStorage.setItem('sidebarCollapsed', newVal.toString());
            return newVal;
        });
    }, []);

    const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

    // --- Profile Fetching ---
    const fetchProfile = useCallback(async () => {
        try {
            const user = await api.getUserProfile('me');
            if (user) setCurrentUser(user);
        } catch (e) {
            console.error("Profile fetch error", e);
        }
    }, []);

    useEffect(() => {
        fetchProfile().finally(() => setLoading(false));
    }, [fetchProfile]);

    // --- Auth Actions ---

    const login = useCallback(async (email: string, password: string) => {
        try {
            const result = await signIn('credentials', {
                redirect: false,
                email,
                password
            });

            if (result?.error) {
                let errorMessage = 'Invalid email or password';
                if (result.error === 'CredentialsSignin') errorMessage = 'Invalid email or password. ';
                else if (result.error === 'OAuthAccountNotLinked') errorMessage = 'This email is already linked to another provider (Google or Discord).';

                throw new Error(errorMessage);
            }

            await fetchProfile();
            showToast('Logged in successfully', 'success');
        } catch (e: any) {
            showToast(e.message || 'An error occurred during sign in', 'error');
            throw e;
        }
    }, [showToast, fetchProfile]);

    const logout = useCallback(async () => {
        try {
            await signOut({ redirect: false });
            setCurrentUser(null);
            localStorage.removeItem('token');
            showToast('Logged out', 'info');
        } catch (e) {
            console.error("Logout error", e);
            showToast('Error during logout', 'error');
        }
    }, [showToast]);

    const register = useCallback(async (username: string, email: string, password: string) => {
        try {
            await api.register(username, email, password);
            showToast('Registration successful! Please sign in.', 'success');
        } catch (e: any) {
            showToast(e.message, 'error');
            throw e;
        }
    }, [showToast]);

    // --- User Actions ---

    const toggleBookmark = useCallback(async (mangaId: string) => {
        if (!currentUser) { showToast('Please login to bookmark', 'error'); return; }
        const isBookmarked = currentUser.bookmarks.includes(mangaId);
        const updatedBookmarks = isBookmarked
            ? currentUser.bookmarks.filter(id => id !== mangaId)
            : [...currentUser.bookmarks, mangaId];

        // Optimistic update
        setCurrentUser(prev => prev ? ({ ...prev, bookmarks: updatedBookmarks }) : null);

        try {
            await api.updateUserProfile(currentUser.id, { bookmarks: updatedBookmarks });
            showToast(isBookmarked ? 'Removed from bookmarks' : 'Added to bookmarks', 'success');
        } catch (e) {
            showToast('Failed to update bookmarks', 'error');
            fetchProfile(); // Revert
        }
    }, [currentUser, showToast, fetchProfile]);

    const addToHistory = useCallback(async (mangaId: string, chapterId: string) => {
        if (!currentUser) return;
        try {
            await api.updateUserProfile(currentUser.id, {
                historyItem: { mangaId, chapterId }
            });
            await fetchProfile();
        } catch (e) {
            console.error("History error", e);
        }
    }, [currentUser, fetchProfile]);

    const unlockChapter = useCallback(async (chapterId: string, price: number): Promise<boolean> => {
        if (!currentUser) { showToast('Login to unlock chapters', 'error'); return false; }

        try {
            const result = await api.unlockChapter(chapterId, price);
            if (result.success) {
                await fetchProfile();
                showToast(`Chapter unlocked!`, 'success');
                return true;
            } else {
                showToast(result.error || 'Transaction failed', 'error');
                return false;
            }
        } catch (e) {
            showToast('Transaction error', 'error');
            return false;
        }
    }, [currentUser, showToast, fetchProfile]);

    const earnCoins = useCallback(async (amount: number) => {
        if (!currentUser) return;
        try {
            await api.updateUserProfile(currentUser.id, { coins: (currentUser.coins || 0) + amount });
            await fetchProfile();
            showToast(`Earned ${amount} coins!`, 'success');
        } catch (e) {
            showToast('Failed to update coins', 'error');
        }
    }, [currentUser, fetchProfile, showToast]);

    const rateManga = useCallback(async (mangaId: string, rating: number) => {
        if (!currentUser) { showToast('Please login to rate', 'error'); return; }
        try {
            await api.updateMangaRating(mangaId, rating);
            showToast('Rating submitted', 'success');
        } catch (e: any) {
            showToast(e.message, 'error');
            throw e;
        }
    }, [currentUser, showToast]);

    const addComment = useCallback(async (mangaId: string, content: string) => {
        if (!currentUser) { showToast('Please login to comment', 'error'); return null; }
        try {
            const newComment = await api.addComment(mangaId, content);
            if (newComment) {
                showToast('Comment posted', 'success');
                return newComment;
            }
            return null;
        } catch (e: any) {
            showToast(e.message, 'error');
            return null;
        }
    }, [currentUser, showToast]);

    const incrementMangaView = useCallback(async (mangaId: string) => {
        try {
            await api.incrementViews(mangaId);
        } catch (e) {
            console.error("View count error", e);
        }
    }, []);

    // --- Notifications Logic ---

    const fetchNotificationStates = useCallback(async () => {
        if (!currentUser) return;
        try {
            const states = await api.getNotificationStates();
            const readIds = states.filter((s: any) => s.isRead).map((s: any) => s.notifId);
            const clearedIds = states.filter((s: any) => s.isCleared).map((s: any) => s.notifId);
            setClearedNotifications(clearedIds);

            setNotifications(prev => {
                // Filter out cleared ones and update isRead for others
                return prev
                    .filter(n => !clearedIds.includes(n.id))
                    .map(n => ({
                        ...n,
                        isRead: readIds.includes(n.id)
                    }));
            });
        } catch (e) {
            console.error("Fetch states error", e);
        }
    }, [currentUser]);

    const refreshNotifications = useCallback(async () => {
        if (!currentUser) return;
        try {
            const mangas = await api.getMangas();
            const bookmarkedMangas = mangas.filter(m => currentUser.bookmarks.includes(m.id));

            const newChapterNotifications: Notification[] = bookmarkedMangas
                .filter(m => {
                    // Check if manga was updated after it was bookmarked
                    const bookmarkInfo = currentUser.detailedBookmarks?.find(b => b.mangaId === m.id);
                    if (!bookmarkInfo) return false;

                    const bookmarkDate = new Date(bookmarkInfo.createdAt).getTime();
                    const mangaUpdateDate = new Date(m.updatedAt).getTime();

                    return mangaUpdateDate > bookmarkDate;
                })
                .map(m => {
                    const latestChapter = m.chapters && m.chapters.length > 0 ? m.chapters[0] : null;
                    const chapterNumStr = latestChapter ? `Chapter ${latestChapter.number}` : 'New Chapter';

                    return {
                        id: `chapter-${m.id}-${m.updatedAt}`,
                        type: 'chapter',
                        title: 'New Chapter!',
                        message: `${chapterNumStr} released for ${m.title}`,
                        mangaId: m.slug,
                        chapterNumber: latestChapter?.number,
                        cover: m.cover,
                        timestamp: m.updatedAt,
                        isRead: false
                    };
                });

            setNotifications(prev => {
                // Filter out notifications that were cleared by the user
                const activeNewNotifs = newChapterNotifications.filter(n => !clearedNotifications.includes(n.id));

                return activeNewNotifs.map(newNotif => {
                    const existing = prev.find(p => p.id === newNotif.id);
                    if (existing) return { ...newNotif, isRead: existing.isRead };
                    return newNotif;
                });
            });

            // After getting notifications, fetch their states from DB to be sure
            await fetchNotificationStates();
        } catch (e) {
            console.error("Notification error", e);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) {
            refreshNotifications();
            // Poll for new notifications every 15 seconds
            const interval = setInterval(refreshNotifications, 15000);
            return () => clearInterval(interval);
        }
    }, [currentUser, refreshNotifications]);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        api.syncNotificationState(id, { isRead: true }).catch(console.error);
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        notifications.forEach(n => {
            api.syncNotificationState(n.id, { isRead: true }).catch(console.error);
        });
    }, [notifications]);

    const clearNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setClearedNotifications(prev => [...prev, id]);
        api.syncNotificationState(id, { isCleared: true }).catch(console.error);
    }, []);

    const clearAllNotifications = useCallback(() => {
        const allIds = notifications.map(n => n.id);
        setClearedNotifications(prev => [...prev, ...allIds]);
        setNotifications([]);
        notifications.forEach(n => {
            api.syncNotificationState(n.id, { isCleared: true }).catch(console.error);
        });
    }, [notifications]);

    // --- Upload Utilities (used by AdminClient) ---

    const uploadChapterImages = useCallback(async (files: File[], mangaId: string, mangaTitle: string, chapterNumber: number): Promise<string[]> => {
        const uploadedUrls: string[] = [];
        const cleanStr = (s: string) =>
            s.trim().replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_') || 'manga';
        const randomSlug = generateRandomSlug(12);
        const folderName = `uploads/chapters/${cleanStr(mangaTitle)}/${randomSlug}`;

        for (const file of files) {
            const urls = await api.uploadFile(folderName, file);
            if (urls && urls.length > 0) {
                uploadedUrls.push(...urls);
            }
        }
        return uploadedUrls;
    }, []);

    const uploadSingleImage = useCallback(async (file: File, folder: string): Promise<string | null> => {
        const urls = await api.uploadFile(folder, file);
        return urls && urls.length > 0 ? urls[0] : null;
    }, []);

    // --- Context Value ---

    const storeValue = useMemo(() => ({
        currentUser, isAuthenticated: !!currentUser,
        login, logout, register, toggleBookmark, addToHistory,
        rateManga, addComment, incrementMangaView,
        unlockChapter, earnCoins,
        uploadChapterImages, uploadSingleImage,
        notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAllNotifications,
        isSidebarCollapsed, toggleSidebar
    }), [
        currentUser,
        login, logout, register, toggleBookmark, addToHistory,
        rateManga, addComment, incrementMangaView,
        unlockChapter, earnCoins,
        uploadChapterImages, uploadSingleImage,
        notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAllNotifications,
        isSidebarCollapsed, toggleSidebar
    ]);

    return (
        <StoreContext.Provider value={storeValue}>
            {loading ? (
                <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[50]">
                    <div className="relative mb-6">
                        <img src="/logo1.png" alt="Loading" className="w-20 h-20 object-contain relative z-10" />
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse"></div>
                    </div>
                </div>
            ) : (
                children
            )}
        </StoreContext.Provider>
    );
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) throw new Error('useStore must be used within StoreProvider');
    return context;
};
