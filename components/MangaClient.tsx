"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '../context/StoreContext';
import {
    Bookmark, Star, Lock, Unlock, Gem, X, Share2,
    ChevronDown, ChevronUp, ChevronRight, ShoppingCart, Search
} from 'lucide-react';
import { Chapter, Manga, Comment } from '../types';
import { useToast } from '../context/ToastContext';
import CommentSection from './CommentSection';
import { api } from '../services/api';
import { getImageUrl } from '../lib/image';

const formatTimeAgo = (date: Date | string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval >= 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval >= 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval >= 1) return Math.floor(interval) + " minutes ago";
    return "Just now";
};

// --- Modals ---
const UnlockModal = ({ chapter, userCoins, isAuthenticated, onClose, onUnlock }: any) => (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/20">
                    <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Unlock Chapter</h2>
                <p className="text-zinc-400 text-sm mt-2">Chapter <span className="text-white font-bold">{chapter.number}</span> costs <span className="text-rose-500 font-bold">{chapter.price} coins</span>.</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 mb-6 flex justify-between items-center border border-white/5">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Balance</span>
                <span className="text-rose-500 font-black flex items-center gap-1.5"><Gem className="w-4 h-4 fill-current" /> {userCoins}</span>
            </div>
            <div className="flex flex-col gap-3">
                {!isAuthenticated ? (
                    <Link href="/login" className="w-full bg-[#e11d48] hover:bg-[#be123c] text-white text-center font-black py-3 rounded-xl transition-all">LOGIN TO UNLOCK</Link>
                ) : userCoins >= chapter.price ? (
                    <button onClick={onUnlock} className="w-full bg-[#e11d48] hover:bg-[#be123c] text-white font-black py-3 rounded-xl transition-all">UNLOCK NOW (-{chapter.price})</button>
                ) : (
                    <Link href="/buy-coins" className="w-full bg-zinc-800 text-zinc-400 text-center font-black py-3 rounded-xl border border-white/5 hover:bg-zinc-700">INSUFFICIENT COINS - TOP UP</Link>
                )}
            </div>
        </div>
    </div>
);

const BulkUnlockModal = ({ count, totalCost, userCoins, onClose, onConfirm }: any) => (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/20">
                    <ShoppingCart className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Bulk Unlock</h2>
                <p className="text-zinc-400 text-sm mt-2">Unlock <span className="text-white font-bold">{count} chapters</span> for <span className="text-rose-500 font-bold">{totalCost} coins</span>?</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 mb-6 flex justify-between items-center border border-white/5">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Balance</span>
                <span className="text-rose-500 font-black flex items-center gap-1.5"><Gem className="w-4 h-4 fill-current" /> {userCoins}</span>
            </div>
            <div className="flex flex-col gap-3">
                {userCoins >= totalCost ? (
                    <button onClick={onConfirm} className="w-full bg-[#e11d48] hover:bg-[#be123c] text-white font-black py-3 rounded-xl transition-all">CONFIRM PURCHASE</button>
                ) : (
                    <Link href="/buy-coins" className="w-full bg-zinc-800 text-zinc-400 text-center font-black py-3 rounded-xl border border-white/5 hover:bg-zinc-700">INSUFFICIENT COINS</Link>
                )}
                <button onClick={onClose} className="w-full bg-transparent hover:bg-white/5 text-zinc-500 font-bold py-3 rounded-xl transition-all">CANCEL</button>
            </div>
        </div>
    </div>
);

const ChapterListItem = ({ chapter, mangaSlug, isUnlocked, onUnlockClick, badgeText }: any) => {
    const isFreeByTime = chapter.freeDate && new Date() > new Date(chapter.freeDate);
    const isPaid = chapter.price > 0 && !isFreeByTime;
    const isLocked = isPaid && !isUnlocked;
    const dateStr = new Date(chapter.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const content = (
        <div className={`p-4 rounded-lg flex items-center justify-between transition-colors ${isLocked ? 'bg-[#0a0a0a] border border-white/5 opacity-70' : 'bg-[#121212] hover:bg-[#1a1a1a] border border-white/5'}`}>
            <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-300">Chapter {chapter.number}</span>
                    {chapter.sourceName && (
                        <div
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border shadow-sm transition-all"
                            style={{
                                backgroundColor: `${chapter.sourceColor || '#e11d48'}15`,
                                borderColor: `${chapter.sourceColor || '#e11d48'}30`,
                                color: chapter.sourceColor || '#e11d48'
                            }}
                        >
                            <span className="text-[10px] font-black uppercase tracking-tight">{chapter.sourceName}</span>
                        </div>
                    )}
                    {isLocked && <Lock className="w-3 h-3 text-rose-500" />}
                    {!isLocked && isPaid && <Unlock className="w-3 h-3 text-emerald-500" />}
                </div>
                {chapter.title && <span className="text-xs text-zinc-500 truncate">{chapter.title}</span>}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
                {badgeText ? (
                    <span className={`text-[9px] font-black text-white px-1.5 py-0.5 rounded tracking-widest uppercase leading-none ${badgeText === 'FREE' ? 'bg-emerald-500' : 'bg-[#e11d48]'}`}>
                        {badgeText}
                    </span>
                ) : (
                    <span className="text-[11px] text-zinc-500 font-medium">{dateStr}</span>
                )}
            </div>
        </div>
    );

    if (isLocked) {
        return <div onClick={() => onUnlockClick(chapter)} className="cursor-pointer active:scale-[0.98] transition-transform">{content}</div>;
    }

    return (
        <Link href={`/series/${mangaSlug}/chapter-${chapter.number}`} className="block active:scale-[0.98] transition-transform">
            {content}
        </Link>
    );
};

interface MangaClientProps {
    initialManga: Manga;
    initialChapters: Chapter[];
    initialComments: Comment[];
    relatedMangas?: Manga[];
}

export default function MangaClient({ initialManga, initialChapters, initialComments, relatedMangas = [] }: MangaClientProps) {
    const { toggleBookmark, currentUser, isAuthenticated, unlockChapter } = useStore();
    const [manga] = useState(initialManga);
    const [activeTab, setActiveTab] = useState<'chapters' | 'reviews'>('chapters');
    const [showUnlockModal, setShowUnlockModal] = useState<Chapter | null>(null);
    const [showBulkModal, setShowBulkModal] = useState<{ count: number, totalCost: number, chapters: Chapter[] } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [chapterSearch, setChapterSearch] = useState('');
    const chaptersPerPage = 20;
    const filteredChapters = useMemo(() => {
        if (!chapterSearch.trim()) return initialChapters;
        return initialChapters.filter(ch => 
            ch.number.toString().includes(chapterSearch) || 
            (ch.title && ch.title.toLowerCase().includes(chapterSearch.toLowerCase()))
        );
    }, [initialChapters, chapterSearch]);

    const totalPages = Math.ceil(filteredChapters.length / chaptersPerPage);

    const sortedChapters = useMemo(() => {
        return [...filteredChapters].sort((a, b) => b.number - a.number); // Keep descending for display
    }, [filteredChapters]);

    const paginatedChapters = useMemo(() => {
        const start = (currentPage - 1) * chaptersPerPage;
        return sortedChapters.slice(start, start + chaptersPerPage);
    }, [sortedChapters, currentPage]);

    // Reset to page 1 when searching
    useEffect(() => {
        setCurrentPage(1);
    }, [chapterSearch]);

    const [commentCount, setCommentCount] = useState(initialComments.length);
    const [locallyUnlockedIds, setLocallyUnlockedIds] = useState<string[]>([]);
    const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
    const [shareText, setShareText] = useState('Share');
    const { showToast } = useToast();

    useEffect(() => {
        const loadCount = async () => {
            try {
                const fetched = await api.getComments(manga.id);
                setCommentCount(fetched.length);
            } catch (e) { }
        };
        loadCount();
    }, [manga.id]);

    const isBookmarked = currentUser?.bookmarks.includes(manga.id);

    const confirmUnlock = async () => {
        if (showUnlockModal) {
            const success = await unlockChapter(showUnlockModal.id, showUnlockModal.price);
            if (success) {
                setLocallyUnlockedIds(prev => prev.includes(showUnlockModal.id) ? prev : [...prev, showUnlockModal.id]);
                setShowUnlockModal(null);
            }
        }
    };

    const confirmBulkUnlock = async () => {
        if (!showBulkModal) return;
        let successCount = 0;
        const unlockedIds: string[] = [];
        for (const ch of showBulkModal.chapters) {
            const success = await unlockChapter(ch.id, ch.price);
            if (success) {
                successCount++;
                unlockedIds.push(ch.id);
            }
        }
        if (unlockedIds.length > 0) setLocallyUnlockedIds(prev => Array.from(new Set([...prev, ...unlockedIds])));
        setShowBulkModal(null);
        if (successCount > 0) showToast(`Successfully unlocked ${successCount} chapters!`, 'success');
    };

    const firstChapter = initialChapters[initialChapters.length - 1];

    return (
        <div className="min-h-screen bg-[#000000] text-zinc-300 pb-20 font-sans">
            {showUnlockModal && (
                <UnlockModal
                    chapter={showUnlockModal}
                    userCoins={currentUser?.coins || 0}
                    isAuthenticated={isAuthenticated}
                    onClose={() => setShowUnlockModal(null)}
                    onUnlock={confirmUnlock}
                />
            )}

            {showBulkModal && (
                <BulkUnlockModal
                    count={showBulkModal.count}
                    totalCost={showBulkModal.totalCost}
                    userCoins={currentUser?.coins || 0}
                    onClose={() => setShowBulkModal(null)}
                    onConfirm={confirmBulkUnlock}
                />
            )}

            <div className="max-w-[1400px] mx-auto pt-8 px-4 md:px-8">
                {/* Breadcrumbs */}
                <div className="flex items-center text-xs text-zinc-500 mb-8 gap-2 font-medium">
                    <Link href="/" className="hover:text-zinc-300 transition-colors">Home</Link>
                    <span>›</span>
                    <Link href={`/search?genre=${manga.genres[0]}`} className="hover:text-zinc-300 transition-colors">{manga.genres[0] || 'Action'}</Link>
                    <span>›</span>
                    <span className="text-zinc-400">{manga.title}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-6 lg:gap-10">
                    {/* LEFT SIDE (Main Info) */}
                    <div className="flex flex-col gap-8 min-w-0">
                        {/* Top Banner Area */}
                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 lg:gap-6">
                            {/* Cover Container */}
                            <div className="w-full sm:w-[280px] lg:w-[320px] shrink-0">
                                <div className="relative rounded-2xl overflow-hidden group border border-[#dc143c]/40 shadow-[0_0_30px_rgba(220,20,60,0.15)] bg-[#0a0a0a]">
                                    <div className="aspect-[3/4.2] relative">
                                        <img src={getImageUrl(manga.cover)} alt={manga.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/10 opacity-90" />

                                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[13px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-black/50">
                                            {manga.rating || '0'} <Star className="w-3 h-3 fill-white text-white" />
                                        </div>

                                        <div className="absolute bottom-4 left-4 right-4 flex gap-3 z-10">
                                            <Link href={firstChapter ? `/series/${manga.slug}/chapter-${firstChapter.number}` : '#'} className="flex-1 bg-[#dc143c] hover:bg-[#be123c] text-white font-bold rounded-xl flex items-center justify-center h-[50px] transition-colors shadow-[0_0_20px_rgba(220,20,60,0.4)] text-[15px]">
                                                Read Now
                                            </Link>
                                            <button onClick={() => toggleBookmark(manga.id)} className="w-[50px] h-[50px] shrink-0 flex items-center justify-center rounded-xl border border-white/10 bg-black/50 backdrop-blur-md hover:bg-black/70 text-white transition-colors shadow-lg shadow-black/50">
                                                <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current text-[#dc143c]' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Details Container */}
                            <div className="flex-1 flex flex-col min-w-0">
                                <div className="mb-6">
                                    <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-white leading-[1.1] italic tracking-tight mb-2">
                                        {manga.title}
                                    </h1>
                                    {(manga as any).alternativeTitle && (
                                        <h2 className="text-lg text-zinc-500 font-medium">{(manga as any).alternativeTitle}</h2>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                    <div className="bg-[#0f0f0f] border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-zinc-500 mb-1 font-semibold uppercase tracking-wider">Author</span>
                                        <span className="text-xs text-white font-bold truncate w-full">{manga.author || 'Unknown'}</span>
                                    </div>
                                    <div className="bg-[#0f0f0f] border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-zinc-500 mb-1 font-semibold uppercase tracking-wider">Artist</span>
                                        <span className="text-xs text-white font-bold truncate w-full">Various</span>
                                    </div>
                                    <div className="bg-[#0f0f0f] border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-zinc-500 mb-1 font-semibold uppercase tracking-wider">Publisher</span>
                                        <span className="text-xs text-white font-bold truncate w-full">{manga.uploaderName || 'Dusk Scans'}</span>
                                    </div>
                                    <div className="bg-[#0f0f0f] border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-zinc-500 mb-1 font-semibold uppercase tracking-wider">Status</span>
                                        <span className="text-xs text-white font-bold truncate w-full">{manga.status}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 mb-6 pb-6 border-b border-white/5">
                                    <div className="flex items-center gap-2">
                                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                        <span className="text-lg text-white font-bold">{manga.rating || '0'}</span>
                                    </div>
                                    <button onClick={() => toggleBookmark(manga.id)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors font-medium">
                                        <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} /> Add to Bookmark
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(window.location.href);
                                            showToast('Manga link copied to clipboard!', 'success');
                                            setShareText('Copied!');
                                            setTimeout(() => setShareText('Share'), 2000);
                                        }}
                                        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors font-medium"
                                    >
                                        <Share2 className="w-4 h-4" /> {shareText}
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {manga.genres.map(g => (
                                        <Link key={g} href={`/search?genre=${g}`} className="px-4 py-1.5 rounded-full bg-[#121212] hover:bg-[#1a1a1a] border border-white/5 text-xs text-zinc-300 font-medium transition-colors">
                                            {g}
                                        </Link>
                                    ))}
                                </div>

                                <div className="mb-6">
                                    <h3 className="text-sm text-white font-bold mb-3">Synopsis</h3>
                                    <p className={`text-sm text-zinc-400 leading-relaxed max-w-3xl ${!isSynopsisExpanded ? 'line-clamp-3' : ''}`}>
                                        {manga.description}
                                    </p>
                                    <button
                                        onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
                                        className="text-[#e11d48] text-xs font-bold flex items-center gap-1 mt-2 hover:underline"
                                    >
                                        {isSynopsisExpanded ? (
                                            <><ChevronUp className="w-3 h-3" /> Show less</>
                                        ) : (
                                            <><ChevronDown className="w-3 h-3" /> Show more</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Information Section */}
                        <div className="bg-[#0a0a0a] rounded-2xl p-6 sm:p-8 border border-white/5 flex flex-col md:flex-row gap-8 relative overflow-hidden">
                            <div className="flex-1 grid grid-cols-1 gap-y-4 text-sm z-10 relative">
                                <h3 className="text-white font-bold mb-2 text-base">Information</h3>

                                <div className="grid grid-cols-[140px_1fr] gap-4 items-start">
                                    <span className="text-zinc-500 font-medium">Alternative Title</span>
                                    <span className="text-zinc-300 leading-snug">{(manga as any).alternativeTitle || manga.title}</span>
                                </div>
                                <div className="grid grid-cols-[140px_1fr] gap-4 items-start">
                                    <span className="text-zinc-500 font-medium">Genres</span>
                                    <span className="text-zinc-300 leading-snug">{manga.genres.join(', ')}</span>
                                </div>
                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                    <span className="text-zinc-500 font-medium">Type</span>
                                    <span className="text-zinc-300">{manga.type}</span>
                                </div>
                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                    <span className="text-zinc-500 font-medium">Status</span>
                                    <span className="text-zinc-300">{manga.status}</span>
                                </div>
                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                    <span className="text-zinc-500 font-medium">First Release</span>
                                    <span className="text-zinc-300">{manga.releaseYear || '2023'}</span>
                                </div>
                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                    <span className="text-zinc-500 font-medium">Latest Release</span>
                                    <span className="text-zinc-300">{initialChapters[0] ? new Date(initialChapters[0].releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                                    <span className="text-zinc-500 font-medium">Views</span>
                                    <span className="text-zinc-300">{manga.views.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Background image bleed inside the info box */}
                            <div className="hidden md:block w-[45%] lg:w-[300px] xl:w-[400px] relative z-0 rounded-xl overflow-hidden shrink-0 right-[-20px] top-[-20px] bottom-[-20px] shadow-inner">
                                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent z-10" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a] z-10" />
                                <img src={getImageUrl(manga.backgroundImage || manga.cover)} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
                            </div>
                        </div>

                        {/* You May Also Like */}
                        {relatedMangas.length > 0 && (
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-white font-bold text-lg">You May Also Like</h3>
                                    <Link href="/browse" className="text-zinc-400 text-xs font-bold hover:text-white flex items-center gap-1 transition-colors uppercase tracking-wider">
                                        View All <ChevronRight className="w-4 h-4" />
                                    </Link>
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                    {relatedMangas.slice(0, 5).map(rm => (
                                        <Link key={rm.id} href={`/series/${rm.slug}`} className="block group">
                                            <div className="aspect-[3/4] rounded-xl overflow-hidden relative border border-white/5 shadow-lg">
                                                <img src={getImageUrl(rm.cover)} alt={rm.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />
                                                <div className="absolute bottom-3 left-3 right-3">
                                                    <h4 className="text-xs font-bold text-white line-clamp-2 leading-tight">{rm.title}</h4>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDE (Chapters) */}
                    <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 flex flex-col h-[600px] lg:h-[0px] lg:min-h-full">
                        <div className="p-4 lg:p-6 border-b border-white/5 space-y-4">
                            <div className="flex items-center justify-between gap-3 sm:gap-6">
                                <div className="flex items-center gap-3 sm:gap-6">
                                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider sm:tracking-widest flex items-center gap-1.5 sm:gap-2">
                                        Chapters
                                        <span className="bg-[#e11d48]/20 text-[#e11d48] text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md">{manga.chapterCount}</span>
                                    </h3>
                                    <button
                                        onClick={() => document.getElementById('comment-section')?.scrollIntoView({ behavior: 'smooth' })}
                                        className="text-base sm:text-lg font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-wider sm:tracking-widest flex items-center gap-1.5 sm:gap-2 group"
                                    >
                                        Comments
                                        <span className="bg-white/5 group-hover:bg-white/10 text-zinc-400 group-hover:text-[#dc143c] text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md transition-colors border border-white/5 group-hover:border-[#dc143c]/30">{commentCount}</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <Search className="w-3.5 h-3.5 text-zinc-500 group-focus-within:text-[#e11d48] transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by chapter number..."
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#e11d48]/50 focus:border-[#e11d48]/50 transition-all placeholder:text-zinc-600 font-bold"
                                    value={chapterSearch}
                                    onChange={(e) => setChapterSearch(e.target.value)}
                                />
                                {chapterSearch && (
                                    <button 
                                        onClick={() => setChapterSearch('')}
                                        className="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-white transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col">
                            <div className="flex flex-col gap-2 flex-1">
                                {paginatedChapters.map((chapter) => {
                                    const isUnlocked = (currentUser?.unlockedChapters.includes(chapter.id) || false) || locallyUnlockedIds.includes(chapter.id);

                                    const now = new Date();
                                    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                    let badgeText = null;

                                    if (chapter.freeDate) {
                                        const freeDate = new Date(chapter.freeDate);
                                        if (freeDate <= now && freeDate >= sevenDaysAgo) {
                                            badgeText = 'FREE';
                                        }
                                    }

                                    if (!badgeText && chapter.releaseDate) {
                                        const releaseDate = new Date(chapter.releaseDate);
                                        if (releaseDate >= sevenDaysAgo) {
                                            badgeText = 'NEW';
                                        }
                                    }

                                    return (
                                        <ChapterListItem
                                            key={chapter.id}
                                            chapter={chapter}
                                            mangaSlug={manga.slug}
                                            isUnlocked={isUnlocked}
                                            onUnlockClick={setShowUnlockModal}
                                            badgeText={badgeText}
                                        />
                                    );
                                })}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 order-2 sm:order-1">
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" /></svg>
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                                        >
                                            <ChevronDown className="w-5 h-5 rotate-90" />
                                        </button>

                                        <div className="flex items-center gap-1.5 px-1">
                                            {[...Array(totalPages)].map((_, i) => {
                                                const pageNum = i + 1;
                                                const displayLabel = totalPages - pageNum + 1;
                                                const isActive = currentPage === pageNum;

                                                if (
                                                    pageNum === 1 ||
                                                    pageNum === totalPages ||
                                                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => setCurrentPage(pageNum)}
                                                            className={`w-9 h-9 rounded-lg font-bold text-xs transition-all border ${isActive
                                                                    ? 'bg-[#e11d48] border-[#e11d48] text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]'
                                                                    : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                                                                }`}
                                                        >
                                                            {displayLabel}
                                                        </button>
                                                    );
                                                }
                                                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                                    return <span key={pageNum} className="text-zinc-600 px-0.5">...</span>;
                                                }
                                                return null;
                                            })}
                                        </div>

                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                                        >
                                            <ChevronDown className="w-5 h-5 -rotate-90" />
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" /></svg>
                                        </button>
                                    </div>
                                    <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest order-1 sm:order-2">
                                        Page <span className="text-white">{totalPages - currentPage + 1}</span> of <span className="text-white">{totalPages}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* BOTTOM SECTION (Comments) */}
                <div id="comment-section" className="mt-12 max-w-5xl mx-auto scroll-mt-24">
                    <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 p-6 lg:p-8">
                        <CommentSection mangaId={manga.id} initialComments={initialComments} onCountChange={setCommentCount} />
                    </div>
                </div>
            </div>
        </div>
    );
}
