"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '../context/StoreContext';
import { Button } from './UIComponents';
import { ChevronLeft, ChevronRight, ArrowLeft, Settings, Lock, Coins, ChevronUp } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Chapter, Manga, Comment } from '../types';
import CommentSection from './CommentSection';
import RelatedSeries from './RelatedSeries';
import { getImageUrl } from '../lib/image';

interface ReaderClientProps {
    mangaId: string;
    chapterId: string;
    initialManga: Manga;
    initialChapters: Chapter[];
    initialComments?: Comment[];
    relatedMangas?: Manga[];
}

export default function ReaderClient({ mangaId, chapterId, initialManga: manga, initialChapters: chapters, initialComments = [], relatedMangas = [] }: ReaderClientProps) {
    const { addToHistory, incrementMangaView, currentUser, unlockChapter } = useStore();
    const { showToast } = useToast();
    const router = useRouter();
    const topRef = useRef<HTMLDivElement>(null);
    const [fitMode, setFitMode] = useState<'width' | 'height' | 'original'>('width');
    const [showSettings, setShowSettings] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);

    const currentChapterIndex = chapters.findIndex(c => c.id === chapterId);
    const currentChapter = chapters[currentChapterIndex];

    const isFreeByTime = currentChapter?.freeDate && new Date() > new Date(currentChapter.freeDate);
    const isPaid = currentChapter?.price > 0 && !isFreeByTime;
    const isUnlocked = currentUser?.unlockedChapters.includes(currentChapter.id) || currentUser?.role === 'admin' || currentUser?.role === 'moderator';
    const isPaidAndLocked = isPaid && !isUnlocked;

    const prevChapter = chapters[currentChapterIndex + 1]; // Chapters sorted desc
    const nextChapter = chapters[currentChapterIndex - 1];

    useEffect(() => {
        if (mangaId && chapterId) {
            addToHistory(mangaId, chapterId);
            incrementMangaView(mangaId);
            topRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [mangaId, chapterId]);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 500);
        };
        window.addEventListener('scroll', handleScroll);

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!manga || !currentChapter) return <div className="text-center py-20 text-white">Chapter not found</div>;

    const navigateToChapter = (num: number) => {
        router.push(`/series/${manga.slug}/chapter-${num}`);
    };

    const getImgClass = () => {
        switch (fitMode) {
            case 'height': return 'h-screen w-auto mx-auto';
            case 'original': return 'max-w-none mx-auto';
            default: return 'w-full h-auto block';
        }
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center pb-20 pt-14">
            <div ref={topRef} />

            {/* Reader Toolbar */}
            <div className="fixed top-0 left-0 right-0 z-[100] w-full bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 shadow-2xl transition-transform duration-300">
                <div className="container mx-auto px-2 md:px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-4 truncate">
                        <Link href={`/series/${manga.slug}`} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all shrink-0 border border-white/5">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <h1 className="font-black text-xs md:text-sm text-white truncate max-w-[120px] md:max-w-[250px] uppercase tracking-tight">
                                    {manga.title}
                                </h1>
                                {currentChapter.sourceName && (
                                    <div
                                        className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border shrink-0 animate-in fade-in duration-500"
                                        style={{
                                            backgroundColor: `${currentChapter.sourceColor || '#e11d48'}15`,
                                            borderColor: `${currentChapter.sourceColor || '#e11d48'}30`,
                                            color: currentChapter.sourceColor || '#e11d48'
                                        }}
                                    >
                                        {currentChapter.sourceName}
                                    </div>
                                )}
                            </div>
                            <p className="text-[9px] md:text-[11px] text-zinc-500 font-medium truncate uppercase tracking-widest">{currentChapter.title}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                        {/* Settings Toggle */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-1.5 md:p-2 rounded transition-colors ${showSettings ? 'bg-primary text-white' : 'hover:bg-white/10 text-zinc-400'}`}
                            >
                                <Settings className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                            {showSettings && (
                                <div className="absolute top-full right-0 mt-2 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl p-2 w-48 flex flex-col gap-1 z-[110] animate-in fade-in zoom-in-95 duration-200">
                                    <span className="text-xs font-bold text-zinc-500 px-2 py-1 uppercase">Image Fit</span>
                                    <button
                                        onClick={() => { setFitMode('width'); setShowSettings(false); }}
                                        className={`text-left px-3 py-2 rounded text-sm ${fitMode === 'width' ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-zinc-300'}`}
                                    >
                                        Fit Width (Default)
                                    </button>
                                    <button
                                        onClick={() => { setFitMode('height'); setShowSettings(false); }}
                                        className={`text-left px-3 py-2 rounded text-sm ${fitMode === 'height' ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-zinc-300'}`}
                                    >
                                        Fit Height
                                    </button>
                                    <button
                                        onClick={() => { setFitMode('original'); setShowSettings(false); }}
                                        className={`text-left px-3 py-2 rounded text-sm ${fitMode === 'original' ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-zinc-300'}`}
                                    >
                                        Original Size
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            disabled={!prevChapter}
                            onClick={() => navigateToChapter(prevChapter.number)}
                            className="p-1.5 md:p-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
                        >
                            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                        </button>

                        <select
                            value={currentChapter.id}
                            onChange={(e) => {
                                const ch = chapters.find(c => c.id === e.target.value);
                                if (ch) navigateToChapter(ch.number);
                            }}
                            className="bg-zinc-900 border border-white/10 text-white text-[10px] md:text-xs rounded-lg focus:ring-1 focus:ring-primary py-1.5 px-3 md:px-4 font-black shadow-lg cursor-pointer hover:bg-zinc-800 transition-all uppercase tracking-widest outline-none"
                        >
                            {chapters.map(c => {
                                const isFree = c.freeDate && new Date() > new Date(c.freeDate);
                                const locked = c.price > 0 && !isFree && !currentUser?.unlockedChapters.includes(c.id) && currentUser?.role !== 'admin' && currentUser?.role !== 'moderator';
                                return (
                                    <option key={c.id} value={c.id}>
                                        Ch. {c.number} {locked ? '(Locked)' : ''}
                                    </option>
                                );
                            })}
                        </select>

                        <button
                            disabled={!nextChapter}
                            onClick={() => navigateToChapter(nextChapter.number)}
                            className="p-1.5 md:p-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
                        >
                            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Reader Content */}
            <div className={`w-full bg-zinc-900 shadow-2xl min-h-screen ${fitMode === 'width' ? 'max-w-3xl' : ''} flex flex-col items-center justify-start pt-6`}>

                {isPaidAndLocked ? (
                    <div className="w-full max-w-md p-8 bg-surface/80 backdrop-blur-md rounded-2xl border border-white/10 text-center my-20">
                        <div className="w-20 h-20 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-6">
                            <Lock className="w-10 h-10" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-white mb-3">Chapter Locked</h2>
                        <p className="text-zinc-400 mb-8 max-w-sm mx-auto">
                            You need to pay <span className="text-rose-500 font-bold">{currentChapter.price} coins</span> to unlock and read Chapter {currentChapter.number}.
                        </p>

                        {!currentUser ? (
                            <Link href="/login" className="block w-full bg-primary hover:bg-primaryDark text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20">
                                Login to Unlock
                            </Link>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-zinc-900/80 rounded-xl p-4 flex justify-between items-center border border-white/5">
                                    <span className="text-zinc-400 font-medium">Your Balance</span>
                                    <span className="text-rose-500 font-bold flex items-center gap-1.5 text-lg">
                                        <Coins className="w-5 h-5 fill-current" /> {currentUser.coins}
                                    </span>
                                </div>
                                {currentUser.coins >= currentChapter.price ? (
                                    <Button
                                        disabled={isUnlocking}
                                        onClick={async () => {
                                            if (isUnlocking) return;
                                            setIsUnlocking(true);
                                            try {
                                                const success = await unlockChapter(currentChapter.id, currentChapter.price);
                                                if (success) {
                                                    // Router refresh is handled inside unlockChapter usually, 
                                                    // but we can force it if needed.
                                                    router.refresh();
                                                }
                                            } finally {
                                                setIsUnlocking(false);
                                            }
                                        }}
                                        className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-rose-600/20 text-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isUnlocking ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Unlocking...
                                            </>
                                        ) : (
                                            <>Unlock Now (-{currentChapter.price})</>
                                        )}
                                    </Button>
                                ) : (
                                    <Button disabled className="w-full bg-zinc-800 text-zinc-500 cursor-not-allowed font-bold py-4 rounded-xl border border-white/5 disabled:opacity-50">
                                        Insufficient Coins
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    (Array.isArray(currentChapter.pages) ? currentChapter.pages : []).map((url, idx) => (
                        <React.Fragment key={idx}>
                            <img
                                src={getImageUrl(url, chapterId)}
                                alt={`Page ${idx + 1}`}
                                loading="lazy"
                                className={`${getImgClass()} cursor-pointer`}
                                onClick={() => window.scrollBy({ top: window.innerHeight * 0.5, left: 0, behavior: 'smooth' })}
                            />

                        </React.Fragment>
                    ))
                )}
            </div>

            {/* Bottom Nav */}
            <div className="w-full max-w-3xl mx-auto p-6 space-y-4">
                <div className="flex justify-between gap-4">
                    <Button
                        variant="secondary"
                        className="flex-1"
                        disabled={!prevChapter}
                        onClick={() => navigateToChapter(prevChapter.number)}
                    >
                        <ChevronLeft className="w-4 h-4" /> Previous
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1"
                        disabled={!nextChapter}
                        onClick={() => navigateToChapter(nextChapter.number)}
                    >
                        Next <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="pt-10 border-t border-white/5 mt-10">

                    <RelatedSeries mangas={relatedMangas} />
                </div>

                <div className="pt-10 border-t border-white/5 mt-10 flex flex-col items-center">

                    <div className="w-full">
                        <CommentSection
                            mangaId={mangaId}
                            chapterId={chapterId}
                            initialComments={initialComments}
                        />
                    </div>
                </div>
            </div>

            {/* Scroll to Top Button */}
            <button
                onClick={scrollToTop}
                className={`fixed bottom-20 md:bottom-8 right-6 md:right-8 z-50 p-3 bg-primary hover:bg-primaryDark text-white rounded-full shadow-[0_0_15px_rgba(220,20,60,0.5)] transition-all duration-300 transform ${showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}
                aria-label="Scroll to top"
            >
                <ChevronUp className="w-5 h-5" />
            </button>
        </div>
    );
}
