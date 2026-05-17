import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Star, Clock, Eye, Calendar, BookOpen, ChevronRight, TrendingUp, ChevronLeft, Coins, Lock, Unlock, Flame, Crown, Bookmark, Plus, Sword, Swords, Castle, Ghost } from 'lucide-react';
import { Manga, Chapter } from '../types';
import { Badge, Button } from './UIComponents';
import { useStore } from '../context/StoreContext';
import { api } from '../services/api';
import { getImageUrl } from '../lib/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

export const MangaCard = React.memo(({ manga, rank }: { manga: Manga; rank?: number }) => {
    const { currentUser, toggleBookmark } = useStore();
    const [chapters, setChapters] = useState<Chapter[]>(
        // Use chapters already attached to the manga object if available (avoids redundant API calls)
        (manga as any).chapters?.length > 0 ? (manga as any).chapters : []
    );

    useEffect(() => {
        // Only fetch chapters from API if the manga doesn't already have them attached
        if ((manga as any).chapters?.length > 0) return;
        const loadChapters = async () => {
            try {
                const fetched = await api.getChapters(manga.id);
                setChapters(fetched.sort((a, b) => b.number - a.number));
            } catch (e) { }
        };
        loadChapters();
    }, [manga.id]);

    const latestChapter = chapters.length > 0 ? chapters[0] : null;

    // Find continue chapter from history
    const userHistory = currentUser?.history?.find(h => h.mangaId === manga.id);
    const continueChapter = useMemo(() => {
        if (!chapters.length) return null;
        if (!userHistory) return chapters[chapters.length - 1]; // First chapter if no history

        // Find the next chapter after the one in history, or the same one if it's the last read
        const lastReadIndex = chapters.findIndex(c => c.id === userHistory.chapterId);
        if (lastReadIndex > 0) return chapters[lastReadIndex - 1]; // Chapters are sorted desc, so index - 1 is the next (higher) number
        return chapters[lastReadIndex];
    }, [chapters, userHistory]);

    return (
        <div className="group relative flex flex-col gap-3">
            <Link href={`/series/${manga.slug}`} className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xl transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-primary/20">
                <img
                    src={getImageUrl(manga.cover)}
                    alt={manga.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />



                {/* Remove Bookmark Button (Top Right) */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(manga.id); }}
                        title="Remove from Library"
                        className="w-8 h-8 bg-primary/80 backdrop-blur-md rounded-lg flex items-center justify-center border border-primary/60 text-white hover:bg-red-600 transition-colors shadow-lg"
                    >
                        <Bookmark className="w-4 h-4 fill-current" />
                    </button>
                </div>

                {rank && (
                    <div className="absolute top-0 right-3 w-8 h-10 bg-gradient-to-b from-primary to-primaryDark flex items-center justify-center rounded-b-lg shadow-xl">
                        <span className="text-lg font-serif font-black italic text-black">#{rank}</span>
                    </div>
                )}

                {/* Bottom Overlay Stats */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex-1" />
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${manga.status === 'Ongoing' ? 'text-green-400' : 'text-blue-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${manga.status === 'Ongoing' ? 'bg-green-400' : 'bg-blue-400'}`} />
                        {manga.status}
                    </div>
                </div>
            </Link>

            <div className="px-1">
                <Link href={`/series/${manga.slug}`}>
                    <h3 className="font-black text-sm text-zinc-100 group-hover:text-primary transition-colors line-clamp-1 mb-3 text-center" title={manga.title}>
                        {manga.title}
                    </h3>
                </Link>

                <div className="grid grid-cols-2 gap-2">
                    <Link
                        href={continueChapter ? `/series/${manga.slug}/chapter-${continueChapter.number}` : `/series/${manga.slug}`}
                        className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-xl py-2 hover:bg-white/10 transition-all group/btn"
                    >
                        <span className="text-[11px] font-black text-zinc-100 group-hover/btn:text-white">
                            {continueChapter ? `Ch. ${continueChapter.number}` : 'No Ch.'}
                        </span>
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                            {userHistory ? 'Continue' : 'Start'}
                        </span>
                    </Link>
                    <Link
                        href={latestChapter ? `/series/${manga.slug}/chapter-${latestChapter.number}` : `/series/${manga.slug}`}
                        className="flex flex-col items-center justify-center bg-primary/10 border border-primary/20 rounded-xl py-2 hover:bg-primary/20 transition-all group/btn"
                    >
                        <span className="text-[11px] font-black text-primary group-hover/btn:brightness-125">
                            {latestChapter ? `Ch. ${latestChapter.number}` : 'No Ch.'}
                        </span>
                        <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">Latest</span>
                    </Link>
                </div>
            </div>
        </div>
    );
});

export const HeroSlider: React.FC<{ featured: Manga[] }> = ({ featured }) => {
    const slides = featured;
    const [emblaRef, emblaApi] = useEmblaCarousel(
        { loop: true, align: 'center', containScroll: false, startIndex: Math.floor(featured.length / 2) },
        [Autoplay({ delay: 3500, stopOnInteraction: true })]
    );
    const [selectedIndex, setSelectedIndex] = useState(0);
    const onSelect = useCallback(() => { if (!emblaApi) return; setSelectedIndex(emblaApi.selectedScrollSnap()); }, [emblaApi]);
    useEffect(() => { if (!emblaApi) return; onSelect(); emblaApi.on('select', onSelect); emblaApi.on('reInit', onSelect); }, [emblaApi, onSelect]);
    if (!featured.length) return null;
    const activeManga = featured[selectedIndex % featured.length] || featured[0];
    return (
        <div className="relative z-10 overflow-hidden" style={{ background: 'transparent' }}>
            <div className="absolute inset-0 z-0 select-none pointer-events-none overflow-hidden">
                <img key={activeManga.id} src={getImageUrl(activeManga.cover)} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-[30px] brightness-[0.55] transition-all duration-1000 ease-in-out" />
                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
                <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
            </div>
            <div className="embla-hero relative z-10 py-8 md:py-10" ref={emblaRef}>
                <div className="embla-hero__container">
                    {slides.map((manga: Manga, index: number) => {
                        const isActive = index === selectedIndex;
                        return (
                            <div key={`${manga.id}-${index}`} className={`embla-hero__slide ${isActive ? 'is-active' : ''}`}>
                                <Link href={`/series/${manga.slug}`} className="slide-link block relative group" onClick={(e) => { if (!isActive && emblaApi) { e.preventDefault(); emblaApi.scrollTo(index); } }}>
                                    <img src={getImageUrl(manga.cover)} alt={manga.title} className="w-full h-full object-cover transition-transform duration-500 ease-out" loading={index === 0 ? "eager" : "lazy"} draggable="false" />
                                    <div className="slide-overlay absolute inset-0 transition-colors duration-500 rounded-lg"></div>
                                    <div className={`slide-content top-badge absolute top-0 left-0 bg-black/90 px-2 py-1 flex items-center gap-1 rounded-br-lg border-b border-r border-white/10 z-20`}>
                                        <Star className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                                        <span className="text-[11px] font-black text-white">{manga.rating || 'N/A'}</span>
                                    </div>
                                    <div className={`slide-content bottom-title absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-16 pb-3 px-3 z-20`}>
                                        <h3 className="text-sm font-black text-white text-center leading-tight drop-shadow-xl" style={{ textShadow: '0px 2px 4px rgba(0,0,0,0.8)' }}>{manga.title}</h3>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─── dusk Scans Style Hero Slider ────────────────────────────────────────────
// ─── dusk Scans Style Hero Slider ────────────────────────────────────────────
export const DuskHeroSlider: React.FC<{ featured: Manga[] }> = ({ featured }) => {
    const { currentUser, toggleBookmark } = useStore();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    const goTo = useCallback((idx: number) => {
        if (isAnimating) return;
        setIsAnimating(true);
        setSelectedIndex(idx);
        setTimeout(() => setIsAnimating(false), 500);
    }, [isAnimating, featured.length]);

    const prev = useCallback(() => goTo((selectedIndex - 1 + featured.length) % featured.length), [goTo, selectedIndex, featured.length]);
    const next = useCallback(() => goTo((selectedIndex + 1) % featured.length), [goTo, selectedIndex, featured.length]);

    // Autoplay
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setSelectedIndex(i => (i + 1) % featured.length);
        }, 5000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [featured.length]);

    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Minimum distance required to trigger a slide change
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        setTouchEnd(null);
        setTouchStart('touches' in e ? e.touches[0].clientX : e.clientX);
    };

    const onTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        setTouchEnd('touches' in e ? e.touches[0].clientX : e.clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe) next();
        if (isRightSwipe) prev();
    };

    if (!featured.length) return null;
    const manga = featured[selectedIndex] || featured[0];

    return (
        <div
            className="vx-hero"
            style={{
                position: 'relative', width: '100%', height: '460px',
                overflow: 'hidden', background: '#000000', cursor: 'grab'
            }}
            onMouseDown={onTouchStart}
            onMouseMove={(e) => touchStart && onTouchMove(e)}
            onMouseUp={onTouchEnd}
            onMouseLeave={onTouchEnd}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Main Background Images (Clear, not blurred) */}
            {featured.map((m, i) => (
                <div key={m.id} style={{
                    position: 'absolute', inset: 0,
                    opacity: i === selectedIndex ? 1 : 0,
                    transition: 'opacity 0.8s ease-in-out',
                    zIndex: 0,
                }}>
                    <picture>
                        <source media="(min-width: 768px)" srcSet={getImageUrl(m.backgroundImage || m.cover)} />
                        <img
                            src={getImageUrl(m.cover)}
                            alt=""
                            draggable="false"
                            className="w-full h-full object-cover object-top md:object-[right_20%]"
                            style={{ userSelect: 'none' }}
                        />
                    </picture>
                    {/* Gradient Overlay: Bottom-up on mobile, Left-Right on desktop */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/80 to-transparent md:bg-gradient-to-r md:from-[#000000] md:via-[#000000]/80 md:to-transparent" />
                    {/* Extra bottom fade for seamless transition */}
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#000000] to-transparent" />
                </div>
            ))}

            {/* Content Container */}
            <div style={{
                position: 'relative', zIndex: 10,
                height: '100%', maxWidth: '1800px', margin: '0 auto',
                padding: '0 40px', display: 'flex', alignItems: 'center',
            }}>
                {/* ── Left Info Area ── */}
                <div style={{ maxWidth: '550px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{
                        display: 'inline-block', background: '#9f1239', color: '#fff',
                        fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em',
                        padding: '4px 12px', borderRadius: '4px', width: 'fit-content',
                        boxShadow: '0 4px 12px rgba(159,18,57,0.3)',
                    }}>HOT PICK</span>

                    <h1 style={{
                        fontSize: 'clamp(28px, 4.5vw, 54px)', // Slightly smaller to fit more text
                        fontWeight: 900, 
                        color: '#fff',
                        lineHeight: 1.1, 
                        textTransform: 'uppercase', 
                        fontStyle: 'italic',
                        letterSpacing: '-0.05em', // Tighter letters
                        textShadow: '0 4px 20px rgba(0,0,0,0.8)',
                        margin: '4px 0',
                        height: '3.3em', // Adjusted for 1.1 line-height
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}>{manga.title}</h1>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#facc15', fontWeight: 900, fontSize: '16px' }}>
                            <Star className="w-5 h-5" style={{ fill: '#facc15' }} />
                            {manga.rating || '0'}
                        </span>
                        {manga.genres?.slice(0, 2).map(g => (
                            <span key={g} style={{
                                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                color: '#e4e4e7', fontSize: '12px', fontWeight: 700,
                                padding: '3px 12px', borderRadius: '6px',
                            }}>{g}</span>
                        ))}
                    </div>

                    <p style={{
                        fontSize: '14px', color: '#d4d4d8', lineHeight: 1.6,
                        maxWidth: '420px', margin: '4px 0',
                        height: '4.8em', // Exactly 3 lines (1.6 line-height * 3)
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    }}>
                        {manga.description || 'Dive into an epic journey where fate and power collide. Experience the story that everyone is talking about.'}
                    </p>

                    <div className="flex flex-row items-center gap-3 mt-6 w-full max-w-[400px]">
                        <Link href={`/series/${manga.slug}`} className="dusk-btn-primary flex-1">
                            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" /> Read Now
                        </Link>
                        <button
                            onClick={() => toggleBookmark(manga.id)}
                            className="dusk-btn-secondary flex-1"
                        >
                            {currentUser?.bookmarks?.includes(manga.id)
                                ? <><Bookmark className="w-5 h-5 fill-current" /> In Library</>
                                : <><Plus className="w-5 h-5" /> Add to Library</>}
                        </button>
                    </div>
                </div>

                {/* ── Middle Right Arrows ── */}
                <div className="hidden md:flex" style={{
                    position: 'absolute', top: '50%', right: '40px', transform: 'translateY(-50%)',
                    flexDirection: 'row', gap: '10px', zIndex: 100
                }}>
                    <button onClick={prev} style={{
                        width: '46px', height: '46px', borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.3s', backdropFilter: 'blur(8px)',
                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,18,57,0.8)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}>
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={next} style={{
                        width: '46px', height: '46px', borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.3s', backdropFilter: 'blur(8px)',
                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,18,57,0.8)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}>
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Bottom Right Dots ── */}
                <div style={{
                    position: 'absolute', bottom: '40px', right: '40px',
                    display: 'flex', alignItems: 'center', gap: '10px', zIndex: 100
                }}>
                    {featured.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            style={{
                                width: '12px', height: '12px', borderRadius: '50%',
                                background: i === selectedIndex ? '#9f1239' : '#fff',
                                border: 'none', cursor: 'pointer', padding: 0,
                                transition: 'all 0.3s ease',
                                boxShadow: i === selectedIndex ? '0 0 15px rgba(159,18,57,0.6)' : 'none',
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export const ChapterListItem = React.memo(({
    chapter,
    mangaTitle,
    mangaSlug,
    isHistory
}: {
    chapter: Chapter;
    mangaTitle: string;
    mangaSlug?: string;
    isHistory?: boolean
}) => {
    const { currentUser } = useStore();

    // Check if free by time
    const isFreeByTime = chapter.freeDate && new Date() > new Date(chapter.freeDate);
    const isUnlocked = currentUser?.unlockedChapters.includes(chapter.id);
    const effectivePrice = (isFreeByTime || isUnlocked) ? 0 : chapter.price;

    const href = mangaSlug
        ? `/series/${mangaSlug}/chapter-${chapter.number}`
        : `/read/${chapter.mangaId}/${chapter.id}`;

    return (
        <Link
            href={href}
            className="group relative flex items-center justify-between p-3 sm:p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-rose-500/5 hover:border-rose-500/30 transition-all duration-300 overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative flex items-center gap-4 z-10 min-w-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300
                    ${isHistory
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-500 group-hover:border-rose-500/60 group-hover:bg-rose-500/20 group-hover:shadow-[0_0_15px_rgba(225,29,72,0.3)]'
                        : 'border-white/10 bg-white/5 text-zinc-400 group-hover:border-white/20 group-hover:text-white group-hover:bg-white/10'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mr-0.5">CH</span>
                    <span className="text-base font-black">{chapter.number}</span>
                </div>

                <div className="flex flex-col min-w-0">
                    <h4 className="font-bold text-sm sm:text-base text-zinc-200 group-hover:text-white transition-colors flex items-center gap-2 truncate">
                        <span className="truncate">{isHistory ? mangaTitle : `Chapter ${chapter.number}`}</span>

                        {chapter.sourceName && (
                            <div
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-tight"
                                style={{
                                    backgroundColor: `${chapter.sourceColor || '#e11d48'}15`,
                                    borderColor: `${chapter.sourceColor || '#e11d48'}30`,
                                    color: chapter.sourceColor || '#e11d48'
                                }}
                            >
                                {chapter.sourceName}
                            </div>
                        )}

                        {!isHistory && effectivePrice > 0 && (
                            <Badge color="bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1 px-1.5 py-0.5 text-[10px] shrink-0">
                                <Coins className="w-3 h-3" /> {effectivePrice}
                            </Badge>
                        )}
                        {!isHistory && isUnlocked && chapter.price > 0 && (
                            <Badge color="bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1 px-1.5 py-0.5 text-[10px] shrink-0">
                                <Unlock className="w-3 h-3" /> Purchased
                            </Badge>
                        )}
                    </h4>
                    <div className="text-[11px] sm:text-xs text-zinc-500 font-medium flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(chapter.releaseDate).toLocaleDateString()}
                        </span>
                        {isHistory && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-rose-400 font-bold">Ch. {chapter.number}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {!isHistory && (
                <div className="relative flex items-center gap-3 shrink-0 z-10">
                    {effectivePrice === 0 && !isUnlocked && (
                        <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">
                            Free
                        </span>
                    )}
                    <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-zinc-300 font-bold text-xs border border-white/10 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors">
                        <BookOpen className="w-3 h-3" /> Read
                    </div>
                </div>
            )}
            {isHistory && (
                <div className="relative shrink-0 z-10 pl-2 hidden sm:block">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white text-zinc-500 transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(225,29,72,0.4)]">
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                </div>
            )}
        </Link>
    );
});

export const LatestUpdateCard: React.FC<{ manga: Manga; chapters: Chapter[] }> = ({ manga, chapters }) => {
    const { currentUser } = useStore();

    const getTimeLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffHours / 24;

        if (diffHours < 24) return `${Math.floor(diffHours) || 1} hours ago`;
        if (diffDays < 7) return `${Math.floor(diffDays)} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="flex glass rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all duration-300 group h-auto sm:h-56">
            <div className="w-28 sm:w-36 shrink-0 relative group overflow-hidden bg-background">
                <Link href={`/series/${manga.slug}`} className="block w-full h-full">
                    <img
                        src={getImageUrl(manga.cover)}
                        alt={manga.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 transform-gpu"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                </Link>
            </div>

            <div className="flex-1 p-2 sm:p-3 flex flex-col min-w-0 justify-between">
                <div className="mb-2">
                    <Link href={`/series/${manga.slug}`}>
                        <h3 className="font-bold text-sm sm:text-base text-zinc-100 group-hover:text-primary transition-colors line-clamp-1 leading-tight" title={manga.title}>
                            {manga.title}
                        </h3>
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs mt-1">
                        <div className="flex items-center gap-1 font-bold text-zinc-300">
                            {manga.rating} <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500 fill-rose-500" />
                        </div>
                        <div className="w-1 h-1 rounded-full bg-zinc-600" />
                        <div className="flex items-center gap-1.5 font-medium">
                            <div className={`w-2 h-2 rounded-full ${manga.status === 'Ongoing' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-blue-500'}`} />
                            <span className={manga.status === 'Ongoing' ? 'text-green-400' : 'text-blue-400'}>{manga.status}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1 sm:gap-1.5 mt-auto">
                    {chapters.slice(0, 4).map((ch, idx) => {
                        const isNew = (new Date().getTime() - new Date(ch.releaseDate).getTime()) < 24 * 60 * 60 * 1000;
                        const isFreeByTime = ch.freeDate && new Date() > new Date(ch.freeDate);
                        const isUnlocked = currentUser?.unlockedChapters?.includes(ch.id);

                        // Read status from history
                        const isRead = currentUser?.history?.some(h => h.chapterId === ch.id);

                        // Determine visual status
                        const requiresPayment = ch.price > 0 && !isFreeByTime;
                        const showLock = requiresPayment && !isUnlocked;

                        return (
                            <Link
                                key={ch.id}
                                href={`/series/${manga.slug}/chapter-${ch.number}`}
                                className="flex items-center justify-between px-1 py-1 group/chapter hover:bg-white/5 rounded-md transition-colors"
                            >
                                <div className="flex items-center min-w-0">
                                    {showLock ? (
                                        <Lock className="w-4 h-4 text-amber-500 mr-2 sm:mr-3 shrink-0" />
                                    ) : isRead ? (
                                        <Eye className="w-4 h-4 text-zinc-600 mr-2 sm:mr-3 shrink-0" />
                                    ) : null}

                                    <span className={`text-[12px] sm:text-[13px] font-black truncate transition-colors
                                        ${showLock ? 'text-amber-500' :
                                            isRead ? 'text-zinc-600' :
                                                'text-zinc-100 group-hover/chapter:text-primary'}`}>
                                        Chapter {ch.number}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {isNew ? (
                                        <>
                                            <Flame className={`w-3.5 h-3.5 ${isRead ? 'text-zinc-600 fill-zinc-600' : 'text-rose-500 fill-rose-500'}`} />
                                            <span className={`text-[11px] sm:text-xs font-bold ${isRead ? 'text-zinc-600' : 'text-zinc-400'}`}>New</span>
                                        </>
                                    ) : (
                                        <span className={`text-[10px] sm:text-xs font-bold ${isRead ? 'text-zinc-700' : 'text-zinc-500'}`}>
                                            {getTimeLabel(ch.releaseDate)}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const TrendingRow = ({ trending, getChapters }: { trending: Manga[]; getChapters: (id: string) => Chapter[] }) => {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'start',
        dragFree: true,
        containScroll: 'trimSnaps'
    });

    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setCanScrollLeft(emblaApi.canScrollPrev());
        setCanScrollRight(emblaApi.canScrollNext());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);
    }, [emblaApi, onSelect]);

    if (!trending.length) return null;

    return (
        <div className="w-full relative group/row">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">Trending Today</h2>
                </div>
            </div>

            {canScrollLeft && (
                <button
                    onClick={() => emblaApi?.scrollPrev()}
                    className="absolute left-0 top-1/2 z-20 w-10 h-10 bg-surface border border-white/10 text-white rounded-full flex items-center justify-center hover:bg-primary hover:border-primary transition-all shadow-xl -mt-4 opacity-0 group-hover/row:opacity-100 -ml-3 hidden md:flex"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
            )}

            {canScrollRight && (
                <button
                    onClick={() => emblaApi?.scrollNext()}
                    className="absolute right-0 top-1/2 z-20 w-10 h-10 bg-surface border border-white/10 text-white rounded-full flex items-center justify-center hover:bg-primary hover:border-primary transition-all shadow-xl -mt-4 opacity-0 group-hover/row:opacity-100 -mr-3 hidden md:flex"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            )}

            <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-4 md:gap-5 pb-4">
                    {trending.map((manga, idx) => {
                        const latestChapter = getChapters(manga.id)[0];
                        return (
                            <Link
                                key={manga.id}
                                href={`/series/${manga.slug}`}
                                className="relative flex-shrink-0 min-w-[150px] w-[150px] md:min-w-[190px] md:w-[190px] aspect-[3/4] rounded-lg overflow-hidden snap-start glass hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:border-primary/50 transition-all duration-300 group hover:-translate-y-1 block"
                            >
                                <img
                                    src={getImageUrl(manga.cover)}
                                    alt={manga.title}
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />

                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />


                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                    <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
                                        {manga.title}
                                    </h3>
                                    <div className="flex items-center justify-between text-xs text-zinc-300">
                                        <span className="truncate max-w-[60%] opacity-80">
                                            {latestChapter ? `Chapter ${latestChapter.number}` : 'N/A'}
                                        </span>
                                        <div className="flex items-center gap-0.5 text-rose-500 font-bold bg-black/40 px-1.5 py-0.5 rounded">
                                            <Star className="w-2.5 h-2.5 fill-current" />
                                            {manga.rating}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const ContentRow: React.FC<{ title: string, icon: React.ReactNode, mangas: Manga[], getChapters: (id: string) => Chapter[] }> = ({ title, icon, mangas, getChapters }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const checkScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setCanScrollLeft(scrollLeft > 5);
            setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
        }
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            checkScroll();
            el.addEventListener('scroll', checkScroll);
            window.addEventListener('resize', checkScroll);
        }
        return () => {
            if (el) el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        }
    }, [mangas]);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const isDesktop = window.matchMedia('(min-width: 768px)').matches;
            const cardWidth = isDesktop ? 190 : 150;
            const gap = 20;
            const scrollAmount = cardWidth * 2 + gap;

            scrollRef.current.scrollBy({
                left: direction === 'right' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (!mangas.length) return null;

    return (
        <div className="w-full relative group/row mb-12">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-3">
                    {icon}
                    <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
                </div>
            </div>

            {canScrollLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 z-20 w-10 h-10 bg-surface border border-white/10 text-white rounded-full flex items-center justify-center hover:bg-primary hover:border-primary transition-all shadow-xl -mt-4 opacity-0 group-hover/row:opacity-100 -ml-3 hidden md:flex"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
            )}

            {canScrollRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 z-20 w-10 h-10 bg-surface border border-white/10 text-white rounded-full flex items-center justify-center hover:bg-primary hover:border-primary transition-all shadow-xl -mt-4 opacity-0 group-hover/row:opacity-100 -mr-3 hidden md:flex"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            )}

            <div
                ref={scrollRef}
                className="flex overflow-x-auto gap-4 md:gap-5 pb-4 snap-x scroll-smooth [&::-webkit-scrollbar]:hidden px-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {mangas.map((manga) => {
                    const latestChapter = getChapters(manga.id)[0];
                    return (
                        <Link
                            key={manga.id}
                            href={`/series/${manga.slug}`}
                            className="relative min-w-[150px] w-[150px] md:min-w-[190px] md:w-[190px] aspect-[3/4] overflow-hidden snap-start glass-card group hover:-translate-y-2 block"
                        >
                            <img
                                src={getImageUrl(manga.cover)}
                                alt={manga.title}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 opacity-90 group-hover:opacity-100 transition-transform duration-500"
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />

                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
                                    {manga.title}
                                </h3>
                                <div className="flex items-center justify-between text-[10px] text-zinc-300 font-medium">
                                    <span>
                                        {latestChapter ? `Ch. ${latestChapter.number}` : 'N/A'}
                                    </span>
                                    <div className="flex items-center gap-0.5 text-primary">
                                        <Star className="w-2.5 h-2.5 fill-current" />
                                        {manga.rating}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export const DuskCollections: React.FC = () => {
    const collections = [
        {
            title: 'For Beginners',
            titlesCount: '50+ Titles',
            icon: Sword,
            image: '/collections/beginners.png',
            color: '#ff4d4d',
            genre: 'Action'
        },
        {
            title: 'Action Packed',
            titlesCount: '120+ Titles',
            icon: Swords,
            image: '/collections/action.png',
            color: '#ff4d4d',
            genre: 'Action'
        },
        {
            title: 'Fantasy Worlds',
            titlesCount: '200+ Titles',
            icon: Castle,
            image: '/collections/fantasy.png',
            color: '#ff4d4d',
            genre: 'Fantasy'
        },
        {
            title: 'Revenge Stories',
            titlesCount: '80+ Titles',
            icon: Ghost,
            image: '/collections/revenge.png',
            color: '#ff4d4d',
            genre: 'Drama'
        }
    ];

    return (
        <section className="dusk-collections-section">
            <div className="dusk-section-header" style={{ marginBottom: '16px' }}>
                <div className="flex items-center gap-2">
                    {/* Grid icon like the reference */}
                    <div style={{
                        width: '22px', height: '22px',
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: '2px', flexShrink: 0
                    }}>
                        <div style={{ background: '#dc143c', borderRadius: '3px', boxShadow: '0 0 6px rgba(220,20,60,0.9)' }} />
                        <div style={{ background: '#dc143c', borderRadius: '3px', boxShadow: '0 0 6px rgba(220,20,60,0.9)' }} />
                        <div style={{ background: '#dc143c', borderRadius: '3px', boxShadow: '0 0 6px rgba(220,20,60,0.9)' }} />
                        <div style={{ background: '#dc143c', borderRadius: '3px', boxShadow: '0 0 6px rgba(220,20,60,0.9)' }} />
                    </div>
                    <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Collections</h2>
                </div>
                <Link href="/search" className="dusk-view-all">View All</Link>
            </div>

            <div style={{ position: 'relative' }}>
                <div className="dusk-collections-grid">
                    {collections.map((col, idx) => (
                        <Link
                            key={idx}
                            href={`/search?genre=${col.genre}`}
                            className="dusk-collection-card group"
                        >
                            {/* Background image - right side prominent */}
                            <img
                                src={col.image}
                                alt={col.title}
                                loading="lazy"
                                style={{
                                    position: 'absolute', inset: 0,
                                    width: '100%', height: '100%',
                                    objectFit: 'cover',
                                    objectPosition: 'center top',
                                    transition: 'transform 0.5s ease'
                                }}
                                className="group-hover:scale-105"
                            />

                            {/* Dark gradient overlay - left heavy */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.25) 100%)',
                                zIndex: 1
                            }} />

                            {/* Red corner glow */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'radial-gradient(ellipse at 15% 50%, rgba(220,20,60,0.12), transparent 60%)',
                                zIndex: 2,
                                opacity: 0,
                                transition: 'opacity 0.3s ease'
                            }} className="group-hover:!opacity-100" />

                            {/* Content layer */}
                            <div style={{
                                position: 'relative', zIndex: 3,
                                height: '100%',
                                padding: '14px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                            }}>
                                {/* Top: Icon */}
                                <col.icon style={{
                                    width: '28px', height: '28px',
                                    color: '#dc143c',
                                    filter: 'drop-shadow(0 0 8px rgba(220,20,60,0.9)) drop-shadow(0 0 16px rgba(220,20,60,0.5))',
                                    transition: 'filter 0.3s ease'
                                }} />

                                {/* Bottom: Title + Count */}
                                <div>
                                    <h3 style={{
                                        fontSize: '15px',
                                        fontWeight: 900,
                                        color: '#fff',
                                        margin: 0,
                                        lineHeight: 1.2,
                                        letterSpacing: '0.01em'
                                    }}>{col.title}</h3>
                                    <p style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: 'rgba(255,255,255,0.45)',
                                        margin: '2px 0 0 0'
                                    }}>{col.titlesCount}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Right arrow */}
                <button
                    className="hidden md:flex"
                    style={{
                        position: 'absolute',
                        right: '-14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 30,
                        width: '30px', height: '30px',
                        borderRadius: '50%',
                        background: '#111',
                        border: '1px solid rgba(220,20,60,0.4)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.8)',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#dc143c')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#111')}
                >
                    <ChevronRight style={{ width: '16px', height: '16px', color: '#fff' }} />
                </button>
            </div>
        </section>
    );
};
