"use client";

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '../context/StoreContext';
import { signIn } from 'next-auth/react';
import { MangaCard, ChapterListItem } from './MangaComponents';
import { Card, Input, Button } from './UIComponents';
import { Bookmark, History, LayoutDashboard, Settings, User as UserIcon, Lock, Camera, Save, Coins, AlertCircle } from 'lucide-react';
import { Manga, Chapter, User } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { slugify } from '../lib/slug';
import { getImageUrl } from '../lib/image';

interface ProfileClientProps {
    initialMangas: Manga[];
    initialChapters: Chapter[];
}

const ProfileContent: React.FC<ProfileClientProps> = ({ initialMangas: mangas, initialChapters: chapters }) => {
    const { currentUser, isAuthenticated, uploadSingleImage, login } = useStore();
    const { showToast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const error = searchParams?.get('error');

    // Settings States
    const [settingsSubTab, setSettingsSubTab] = React.useState('profile');
    const [newUsername, setNewUsername] = React.useState(currentUser?.username || '');
    const [bio, setBio] = React.useState(''); // Mocking bio for UI
    const [currentPassword, setCurrentPassword] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
    const [isUpdating, setIsUpdating] = React.useState(false);

    // Notification States
    const [notifChapter, setNotifChapter] = React.useState(currentUser?.notificationsEnabled ?? true);
    const [notifReply, setNotifReply] = React.useState(currentUser?.commentRepliesEnabled ?? true);
    const [notifLike, setNotifLike] = React.useState(currentUser?.likeNotificationsEnabled ?? true);

    // Promo Code States
    const [promoCode, setPromoCode] = React.useState('');
    const [isClaiming, setIsClaiming] = React.useState(false);

    // Auth check
    React.useEffect(() => {
        if (!isAuthenticated && !currentUser) {
            router.push('/login');
        }
    }, [isAuthenticated, currentUser, router]);

    const activeTab = searchParams?.get('tab') || 'history';

    if (!isAuthenticated || !currentUser) return <div className="text-center py-20 text-white min-h-[60vh]">Redirecting to login...</div>;

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const updates: any = {};
            if (newUsername !== currentUser.username) updates.username = newUsername;

            if (newPassword) {
                if (newPassword.length < 6) {
                    showToast('New password must be at least 6 characters', 'error');
                    setIsUpdating(false);
                    return;
                }
                if (newPassword !== confirmPassword) {
                    showToast('Passwords do not match', 'error');
                    setIsUpdating(false);
                    return;
                }
                updates.password = newPassword;
            }

            if (newPassword) {
                if (!currentUser.hasPassword) {
                    // Initial password setup doesn't require currentPassword
                    updates.password = newPassword;
                } else {
                    if (!currentPassword) {
                        showToast('Please enter your current password to set a new one', 'error');
                        setIsUpdating(false);
                        return;
                    }
                    updates.password = newPassword;
                    updates.currentPassword = currentPassword;
                }
            } else if (updates.username && currentPassword && currentUser.hasPassword) {
                // If they provide currentPassword while changing name and they have one, include it
                updates.currentPassword = currentPassword;
            }

            if (avatarFile) {
                const userSlug = slugify(currentUser.username) || 'user';
                const folder = `uploads/avatars/${userSlug}`;
                const imageUrl = await uploadSingleImage(avatarFile, folder);
                if (imageUrl) {
                    // Cleanup old avatar if it was a local file
                    if (currentUser.image && currentUser.image.startsWith('/') && currentUser.image !== imageUrl) {
                        api.deleteFile(currentUser.image).catch(console.error);
                    }
                    updates.image = imageUrl;
                }
            }

            // Notifications
            if (notifChapter !== currentUser.notificationsEnabled) updates.notificationsEnabled = notifChapter;
            if (notifReply !== currentUser.commentRepliesEnabled) updates.commentRepliesEnabled = notifReply;
            if (notifLike !== currentUser.likeNotificationsEnabled) updates.likeNotificationsEnabled = notifLike;

            if (Object.keys(updates).length === 0) {
                showToast('No changes made', 'info');
                setIsUpdating(false);
                return;
            }

            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                showToast('Profile updated successfully', 'success');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setAvatarFile(null);
                // Refresh local session/data if needed
                window.location.reload();
            } else {
                const data = await res.json();
                showToast(data.error || 'Update failed', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('An error occurred', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleClaimPromo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!promoCode.trim()) return;

        setIsClaiming(true);
        try {
            const res = await api.claimPromoCode(promoCode);
            showToast(res.message || 'Promo code redeemed!', 'success');
            setPromoCode('');
            // Refresh to show updated coins
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
            showToast(e.message || 'Claim failed', 'error');
        } finally {
            setIsClaiming(false);
        }
    };

    const bookmarkedMangas = mangas.filter(m => currentUser.bookmarks.includes(m.id));

    const historyItems = currentUser.history.map(h => {
        const manga = mangas.find(m => m.id === h.mangaId);
        const chapter = chapters.find(c => c.id === h.chapterId);
        if (!manga || !chapter) return null;
        return { ...h, manga, chapter };
    }).filter(Boolean);

    return (
        <div className="max-w-5xl mx-auto min-h-[60vh] px-2">
            {/* ── Aurora Profile Banner ── */}
            <div className="relative mb-8 rounded-3xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-900/60 via-rose-900/30 to-indigo-900/60" />
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #d946ef40, transparent 50%), radial-gradient(circle at 70% 50%, #8b5cf640, transparent 50%)' }} />
                <div className="relative z-10 p-8 flex flex-col sm:flex-row items-center sm:items-end gap-6">
                    <div className="relative shrink-0">
                        <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-primary/60 shadow-[0_0_30px_rgba(217,70,239,0.4)]">
                            {currentUser.image
                                ? <img src={getImageUrl(currentUser.image)} alt="" className="w-full h-full object-cover" />
                                : <img src="/logo.png" alt="" className="w-full h-full object-contain p-3" />}
                        </div>
                    </div>
                    <div className="text-center sm:text-left">
                        <h1 className="text-3xl font-extrabold text-white">{currentUser.username}</h1>
                        <p className="text-zinc-300 text-sm mt-1">{currentUser.email}</p>
                        <div className="flex items-center gap-2 mt-3 flex-wrap justify-center sm:justify-start">
                            <span className="px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold uppercase">{currentUser.role}</span>
                            {/* <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-1">
                                <Coins className="w-3 h-3 fill-current" /> {currentUser.coins} Coins
                            </span> */}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 mb-6 p-1 bg-white/[0.03] border border-white/10 rounded-2xl w-fit">
                {[
                    { tab: 'history', icon: <History className="w-4 h-4" />, label: 'History' },
                    { tab: 'bookmarks', icon: <Bookmark className="w-4 h-4" />, label: 'Library' },
                    { tab: 'settings', icon: <Settings className="w-4 h-4" />, label: 'Settings' },
                ].map(({ tab, icon, label }) => (
                    <Link key={tab} href={`/profile?tab=${tab}`}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                            ${activeTab === tab
                                ? 'bg-gradient-to-r from-rose-500/20 to-red-600/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(217,70,239,0.15)]'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                        {icon}{label}
                    </Link>
                ))}
                {(currentUser.role === 'admin' || currentUser.role === 'moderator') && (
                    <Link href="/admin"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
                        <LayoutDashboard className="w-4 h-4" />Admin Panel
                    </Link>
                )}
            </div>

            {activeTab === 'history' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.4)]">
                            <History className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Reading History</h2>
                    </div>
                    {historyItems.length > 0 ? (
                        <div className="max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                            <div className="grid gap-2">
                                {historyItems.map((item: any, idx) => (
                                    <ChapterListItem key={idx} chapter={item.chapter} mangaTitle={item.manga.title} mangaSlug={item.manga.slug} isHistory />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 glass-card text-zinc-400">
                            <History className="w-12 h-12 mb-4 opacity-40 text-primary" />
                            <p className="font-medium">No reading history yet.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'bookmarks' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.4)]">
                            <Bookmark className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Saved Library</h2>
                        <span className="bg-primary/20 border border-primary/40 text-primary text-xs font-bold px-2.5 py-0.5 rounded-full">{bookmarkedMangas.length}</span>
                    </div>
                    {bookmarkedMangas.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {bookmarkedMangas.map(m => <MangaCard key={m.id} manga={m} />)}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 glass-card text-zinc-400">
                            <Bookmark className="w-12 h-12 mb-4 opacity-40 text-primary" />
                            <p className="font-medium">No bookmarks yet.</p>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'settings' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* Sub-Tabs */}
                    <div className="flex gap-6 mb-8 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-2xl">
                        {[
                            { id: 'profile', icon: <UserIcon className="w-4 h-4" />, label: 'Profile Information' },
                            { id: 'security', icon: <Lock className="w-4 h-4" />, label: 'Security' },
                            { id: 'notifications', icon: <AlertCircle className="w-4 h-4" />, label: 'Notifications' },
                        ].map(s => (
                            <button key={s.id} onClick={() => setSettingsSubTab(s.id)}
                                className={`flex items-center gap-2 py-2 text-sm font-bold transition-all relative
                                    ${settingsSubTab === s.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                {s.icon} {s.label}
                                {settingsSubTab === s.id && <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(217,70,239,0.5)]" />}
                            </button>
                        ))}
                    </div>

                    <div className="glass-panel rounded-3xl border-white/5 overflow-hidden">
                        <form id="profile-update-form" onSubmit={handleProfileUpdate}>
                            <div className="p-8">
                                {settingsSubTab === 'profile' && (
                                    <div className="space-y-8 animate-in fade-in duration-300">
                                        <div>
                                            <h2 className="text-2xl font-black text-white">Personal Information</h2>
                                            <p className="text-zinc-500 text-sm mt-1">Update your profile details and bio.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-zinc-400 ml-1">Username</label>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                                                        <UserIcon className="w-4 h-4" />
                                                    </div>
                                                    <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                                                        className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-zinc-400 ml-1">Email Address</label>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                                                        <AlertCircle className="w-4 h-4" />
                                                    </div>
                                                    <input value={currentUser.email || ''} readOnly
                                                        className="w-full bg-[#0d0d0d]/50 border border-white/5 rounded-xl pl-12 pr-12 py-3 text-sm text-zinc-500 cursor-not-allowed" />
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700">
                                                        <Lock className="w-3.5 h-3.5" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 ml-1">Bio</label>
                                            <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                                                placeholder="Tell us about yourself..."
                                                className="w-full h-32 bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none" />
                                        </div>

                                        <div>
                                            <label className="text-sm font-bold text-zinc-400 ml-1 block mb-3">Avatar</label>
                                            <div className="flex items-center gap-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl w-fit">
                                                <div className="w-20 h-20 rounded-2xl border-2 border-primary/30 overflow-hidden shadow-xl">
                                                    {avatarFile ? <img src={URL.createObjectURL(avatarFile)} className="w-full h-full object-cover" />
                                                        : currentUser.image ? <img src={getImageUrl(currentUser.image)} className="w-full h-full object-cover" />
                                                            : <img src="/logo.png" className="w-full h-full object-contain p-2" />}
                                                </div>
                                                <label className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all text-xs font-bold text-zinc-300">
                                                    Change Photo
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {settingsSubTab === 'security' && (
                                    <div className="space-y-8 animate-in fade-in duration-300">
                                        <div>
                                            <h2 className="text-2xl font-black text-white">Security</h2>
                                            <p className="text-zinc-500 text-sm mt-1">Manage your password and account security.</p>
                                        </div>

                                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                                            <label className="block text-xs font-black uppercase tracking-[0.2em] text-zinc-600 mb-4 ml-1">Linked Accounts</label>
                                            <div className="flex flex-wrap gap-4">
                                                {currentUser.linkedAccounts?.includes('discord') ? (
                                                    <div className="flex items-center gap-3 px-5 py-3 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-xl text-[#5865F2] text-sm font-bold shadow-[0_0_20px_rgba(88,101,242,0.1)]">
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.372.292a.077.077 0 0 1-.006.128 12.51 12.51 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
                                                        Discord Connected
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#5865F2] animate-pulse" />
                                                    </div>
                                                ) : (
                                                    <button type="button" onClick={() => signIn('discord', { callbackUrl: '/profile' })}
                                                        className="flex items-center gap-3 px-6 py-3 bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-black rounded-xl transition-all shadow-[0_4px_15px_rgba(88,101,242,0.3)] hover:-translate-y-0.5 active:scale-95">
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.372.292a.077.077 0 0 1-.006.128 12.51 12.51 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
                                                        Connect Discord Account
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-6 max-w-2xl">
                                            {currentUser.hasPassword && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-zinc-400 ml-1">Current Password</label>
                                                    <div className="relative">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                                                            <Lock className="w-4 h-4" />
                                                        </div>
                                                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                                                            className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-zinc-400 ml-1">New Password</label>
                                                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                                        className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-zinc-400 ml-1">Confirm New</label>
                                                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                                        className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {settingsSubTab === 'notifications' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div>
                                            <h2 className="text-2xl font-black text-white">Notification Preferences</h2>
                                            <p className="text-zinc-500 text-sm mt-1">Control how you want to be notified about updates.</p>
                                        </div>

                                        <div className="space-y-4">
                                            {[
                                                {
                                                    id: 'chapter',
                                                    label: 'New Chapter Releases',
                                                    desc: 'Get notified when a bookmarked manga has a new chapter.',
                                                    value: notifChapter,
                                                    setter: setNotifChapter
                                                },
                                                {
                                                    id: 'reply',
                                                    label: 'Comment Replies',
                                                    desc: 'Get notified when someone replies to your comment.',
                                                    value: notifReply,
                                                    setter: setNotifReply
                                                },
                                                {
                                                    id: 'like',
                                                    label: 'Comment Likes',
                                                    desc: 'Get notified when someone likes your comment.',
                                                    value: notifLike,
                                                    setter: setNotifLike
                                                }
                                            ].map(item => (
                                                <div key={item.id} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                                                    <div>
                                                        <h4 className="text-[15px] font-bold text-white">{item.label}</h4>
                                                        <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => item.setter(!item.value)}
                                                        className={`w-12 h-6 rounded-full transition-all duration-300 relative ${item.value ? 'bg-primary shadow-[0_0_12px_rgba(217,70,239,0.3)]' : 'bg-zinc-800'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${item.value ? 'left-7 shadow-lg' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="px-8 py-5 bg-white/[0.02] border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <button type="submit" disabled={isUpdating}
                                    className="px-8 py-3 rounded-xl bg-[#e11d48] text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-red-900/20 hover:bg-[#be123c] active:scale-95 transition-all flex items-center gap-2">
                                    <Save className="w-4 h-4" />
                                    {isUpdating ? 'Saving...' : 'Save Changes'}
                                </button>

                                {settingsSubTab === 'profile' && (
                                    <div className="flex items-center gap-3 px-5 py-2.5 glass-panel rounded-2xl border-dashed border-primary/30">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-black text-primary tracking-widest">Promo Code?</span>
                                            <p className="text-[9px] text-zinc-500">Enter code for bonus coins</p>
                                        </div>
                                        <div className="h-8 w-px bg-white/10 mx-1" />
                                        <div className="flex gap-2">
                                            <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                                placeholder="CODE"
                                                className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 text-xs text-white font-bold focus:outline-none" />
                                            <button type="button" onClick={handleClaimPromo} disabled={isClaiming || !promoCode}
                                                className="text-primary text-xs font-black uppercase hover:text-white transition-colors">
                                                Claim
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function ProfileClient(props: ProfileClientProps) {
    return (
        <Suspense fallback={<div className="text-center py-20 text-white min-h-[60vh]">Loading profile...</div>}>
            <ProfileContent {...props} />
        </Suspense>
    );
}
