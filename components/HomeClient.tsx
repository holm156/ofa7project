"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Manga, Chapter } from '../types';
import { Star, Clock, Flame, ChevronRight, BookOpen, Library, Bell, Compass, Lock, Unlock, Clock3 } from 'lucide-react';
import { getImageUrl } from '../lib/image';
import { DuskHeroSlider, DuskCollections } from './MangaComponents';
import { useStore } from '../context/StoreContext';

interface HomeClientProps {
    initialMangas: (Manga & { chapters: Chapter[] })[];
}

function getTimeAgo(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function getTimeUntil(dateStr: string) {
    const diffMs = new Date(dateStr).getTime() - Date.now();
    if (diffMs <= 0) return 'Free now';

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${Math.max(1, minutes)}m`;
}

function isWithinFreeWindow(dateStr: string, days = 7) {
    const freeAt = new Date(dateStr).getTime();
    const now = Date.now();
    if (now < freeAt) return false;
    return (now - freeAt) <= days * 24 * 60 * 60 * 1000;
}

export default function HomeClient({ initialMangas }: HomeClientProps) {
    const { currentUser } = useStore();

    const featuredMangas = useMemo(() => {
        return initialMangas.filter(m => m.isFeatured);
    }, [initialMangas]);

    const trendingMangas = useMemo(() =>
        [...initialMangas].sort((a, b) => b.views - a.views).slice(0, 12),
        [initialMangas]);

    const latestMangas = useMemo(() =>
        [...initialMangas].sort((a, b) => {
            const aLatest = a.chapterCount > 0 ? new Date(a.chapters[0].releaseDate).getTime() : 0;
            const bLatest = b.chapterCount > 0 ? new Date(b.chapters[0].releaseDate).getTime() : 0;
            if (bLatest !== aLatest) return bLatest - aLatest;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }).slice(0, 12),
        [initialMangas]);

    const topPicks = useMemo(() =>
        [...initialMangas].sort((a, b) => b.rating - a.rating).slice(0, 6),
        [initialMangas]);

    return (
        <div className="dusk-home">
            {/* Hero Slider - Full width */}
            {featuredMangas.length > 0 && (
                <DuskHeroSlider featured={featuredMangas} />
            )}

            {/* Main Content */}
            <div className="dusk-main-content">

                {/* TRENDING TODAY */}
                <section className="dusk-trending-section">
                    <div className="dusk-section-header">
                        <div className="flex items-center gap-2">
                            <Flame className="w-5 h-5 text-primary fill-primary/50" />
                            <h2 className="dusk-section-title">TRENDING TODAY</h2>
                        </div>
                        <Link href="/search" className="dusk-view-all">
                            View All
                        </Link>
                    </div>
                    <div className="dusk-trending-grid">
                        {trendingMangas.slice(0, 6).map((manga, idx) => {
                            const latestCh = manga.chapters?.[0];
                            return (
                                <Link key={manga.id} href={`/series/${manga.slug}`} className="dusk-trending-card group">
                                    <div className="dusk-trending-rank">{idx + 1}</div>
                                    <div className="dusk-trending-cover">
                                        <img src={getImageUrl(manga.cover)} alt={manga.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                    <div className="dusk-trending-info">
                                        <h3 className="dusk-trending-name group-hover:text-primary transition-colors">{manga.title}</h3>
                                        {latestCh && <p className="dusk-trending-chapter">Chapter {latestCh.number}</p>}
                                        <div className="flex items-center gap-1 mt-1">
                                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                            <span className="text-[11px] font-bold text-zinc-300">{manga.rating}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>



                {/* LATEST UPDATES Full Grid */}
                <section className="dusk-trending-section">
                    <div className="dusk-latest-section-header">
                        <div className="dusk-latest-header-left">
                            <div className="dusk-latest-header-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
                                    <path d="M12 2L13.5 8.5L20 7L14.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L9.5 12L4 7L10.5 8.5L12 2Z" />
                                </svg>
                            </div>
                            <h2 className="dusk-latest-section-title">
                                LATEST <em>UPDATES</em>
                            </h2>
                            <div className="dusk-latest-header-line">
                                <div className="dusk-latest-header-arrow">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                        <Link href="/search" className="dusk-view-all">View All</Link>
                    </div>

                    <div className="dusk-new-latest-grid">
                        {latestMangas.map((manga) => {
                            const recentChapters = manga.chapters?.slice(0, 4) || [];
                            return (
                                <div key={manga.id} className="dusk-new-latest-card group">
                                    {/* Left: Cover */}
                                    <Link href={`/series/${manga.slug}`} className="dusk-new-latest-cover-container">
                                        <img src={getImageUrl(manga.cover)} alt={manga.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        <div className="dusk-new-latest-cover-overlay">
                                            <h4 className="dusk-new-latest-cover-title">{manga.title}</h4>
                                        </div>
                                    </Link>

                                    {/* Right: Content */}
                                    <div className="dusk-new-latest-content">
                                        <Link href={`/series/${manga.slug}`} className="dusk-new-latest-title-link">
                                            <h3 className="dusk-new-latest-title group-hover:text-primary transition-colors">{manga.title}</h3>
                                        </Link>

                                        {/* Timeline */}
                                        <div className="dusk-timeline">
                                            {/* Vertical line */}
                                            <div className="dusk-timeline-line"></div>

                                            {/* Chapters */}
                                            <div className="dusk-timeline-chapters">
                                                {recentChapters.map((ch, idx) => {
                                                    const isFreeByTime = !!ch.freeDate && new Date() > new Date(ch.freeDate);
                                                    const isUnlockedByPurchase = !!currentUser?.unlockedChapters?.includes(ch.id);
                                                    const isLocked = ch.price > 0 && !isFreeByTime && !isUnlockedByPurchase;
                                                    const showFreeBadge = !!ch.freeDate && ch.price > 0 && isWithinFreeWindow(ch.freeDate);
                                                    const timeUntilFree = isLocked && ch.freeDate ? getTimeUntil(ch.freeDate) : null;

                                                    return (
                                                        <Link key={ch.id} href={`/series/${manga.slug}/chapter-${ch.number}`} className="dusk-timeline-chapter-row">
                                                            <div className="dusk-timeline-dot"></div>
                                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                                <span className={`dusk-chapter-number ${idx === 0 ? 'text-primary' : 'text-zinc-300'}`}>
                                                                    Chapter {ch.number}
                                                                </span>
                                                                {isLocked ? (
                                                                    <Lock className="w-3 h-3 text-orange-400 fill-orange-400/20" />
                                                                ) : (ch.price > 0 && isUnlockedByPurchase) ? (
                                                                    <Unlock className="w-3 h-3 text-emerald-400" />
                                                                ) : null}
                                                                {timeUntilFree && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-wide inline-flex items-center gap-1">
                                                                        <Clock3 className="w-2.5 h-2.5" />
                                                                        {timeUntilFree}
                                                                    </span>
                                                                )}
                                                                {!isLocked && showFreeBadge && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase tracking-wide">
                                                                        Free
                                                                    </span>
                                                                )}
                                                                {ch.title && (
                                                                    <span className="dusk-chapter-title truncate">- {ch.title}</span>
                                                                )}
                                                            </div>
                                                            <span className={`dusk-chapter-time flex-shrink-0 inline-flex items-center gap-1 ${idx === 0 ? 'text-primary' : 'text-zinc-500'}`}>
                                                                {getTimeAgo(ch.releaseDate)}
                                                            </span>
                                                        </Link>
                                                    );
                                                })}
                                                {recentChapters.length === 0 && (
                                                    <span className="text-xs text-zinc-500">No chapters yet</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* COLLECTIONS */}
                {/* <DuskCollections /> */}
            </div>
        </div>
    );
}
