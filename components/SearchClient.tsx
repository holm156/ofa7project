"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search as SearchIcon, Frown, Plus, Star, ChevronDown, ArrowUpDown, Eye, EyeOff, Bookmark } from 'lucide-react';
import { Manga } from '../types';
import { getImageUrl } from '../lib/image';
import { useStore } from '../context/StoreContext';

/* ─── Pill Filter Button ──────────────────────────────────────────── */
const PillButton = ({
    label,
    icon,
    options,
    value,
    onChange,
}: {
    label: string;
    icon?: React.ReactNode;
    options?: string[];
    value?: string;
    onChange?: (v: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const isActive = value && value !== 'All' && value !== 'Default';

    if (!options) {
        // Simple toggle button
        return (
            <button
                onClick={() => onChange?.('toggle')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200
                    ${isActive
                        ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:border-primary/50 hover:text-white'
                    }`}
            >
                {icon}
                {label}
            </button>
        );
    }

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200
                    ${isActive
                        ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:border-primary/50 hover:text-white'
                    }`}
            >
                {icon}
                {isActive ? value : label}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-2 z-50 min-w-[160px] glass-panel rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-2 border border-white/15 animate-in slide-in-from-top-2">
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => { onChange?.(opt); setOpen(false); }}
                            className={`w-full text-left px-4 py-2 rounded-xl text-sm transition-colors ${value === opt ? 'text-primary bg-primary/10' : 'text-zinc-300 hover:text-white hover:bg-white/5'}`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ─── Manga Browse Card ────────────────────────────────────────────── */
const BrowseCard = React.memo(({ manga }: { manga: Manga & { chapters?: any[] } }) => {
    const chapterCount = manga.chapterCount ?? 0;
    const { currentUser, toggleBookmark } = useStore();
    const isBookmarked = currentUser?.bookmarks?.includes(manga.id);

    return (
        <div className="flex flex-col group h-full">
            {/* Cover */}
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl mb-4 shadow-lg group">
                <Link href={`/series/${manga.slug}`} className="absolute inset-0 z-0 block">
                    <img
                        src={getImageUrl(manga.cover)}
                        alt={manga.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Link>

                {/* Bookmark badge - Top Left */}
                <button 
                    onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        toggleBookmark(manga.id); 
                    }}
                    className="absolute top-3 left-3 flex items-center justify-center w-8 h-8 bg-black/80 backdrop-blur-md rounded-lg border border-white/10 shadow-xl z-10 hover:bg-white/20 transition-colors"
                >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-white text-white' : 'text-white'}`} />
                </button>

                {/* Rating badge - Top Right */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 shadow-xl z-10 pointer-events-none">
                    <Star className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                    <span className="text-xs font-black text-white">{manga.rating || '0'}</span>
                </div>
            </div>

            {/* Info */}
            <div className="flex flex-col flex-1 gap-3 px-0.5">
                <Link href={`/series/${manga.slug}`}>
                    <h3 className="text-[15px] font-black text-white leading-tight line-clamp-1 group-hover:text-primary transition-colors tracking-tight">
                        {manga.title}
                    </h3>
                </Link>

                <div className="flex items-center gap-1.5 mt-auto">
                    <div className="bg-zinc-800/80 border border-white/5 text-zinc-100 text-[10px] sm:text-[11px] font-black px-2 py-1.5 rounded-lg whitespace-nowrap">
                        <span className="hidden sm:inline">{chapterCount} Chapters</span>
                        <span className="sm:hidden">Ch. {chapterCount}</span>
                    </div>
                    <div className={`text-[10px] sm:text-[11px] font-black px-2 py-1.5 rounded-lg border whitespace-nowrap
                        ${manga.status === 'Ongoing'
                            ? 'bg-primary/20 text-primary border-primary/30'
                            : manga.status === 'Completed'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                        {manga.status}
                    </div>
                </div>
            </div>
        </div>
    );
});
BrowseCard.displayName = 'BrowseCard';


/* ─── Main Search Content ──────────────────────────────────────────── */
const SearchContent: React.FC<{ initialMangas: Manga[] }> = ({ initialMangas }) => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialQuery = searchParams?.get('q') || '';
    const initialGenre = searchParams?.get('genre') || 'All';
    const statusParam = searchParams?.get('status');
    const initialStatus = statusParam === 'completed' ? 'Completed' : 'All';
    
    let initialOrder = 'Latest Update';
    const sortParam = searchParams?.get('sort');
    if (sortParam === 'views') initialOrder = 'Most Popular';
    if (sortParam === 'latest' || searchParams?.get('filter') === 'new') initialOrder = 'Latest Update';

    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [inputValue, setInputValue] = useState(initialQuery);
    const [selectedStatus, setSelectedStatus] = useState(initialStatus);
    const [selectedType, setSelectedType] = useState('All');
    const [selectedOrder, setSelectedOrder] = useState(initialOrder);
    const [selectedGenre, setSelectedGenre] = useState(initialGenre);
    const [hideBookmarked, setHideBookmarked] = useState(false);

    // Sync state when URL search params change
    useEffect(() => {
        setSearchQuery(searchParams?.get('q') || '');
        setInputValue(searchParams?.get('q') || '');
        setSelectedGenre(searchParams?.get('genre') || 'All');
        
        const statusParam = searchParams?.get('status');
        setSelectedStatus(statusParam === 'completed' ? 'Completed' : 'All');
        
        let order = 'Latest Update';
        const sortParam = searchParams?.get('sort');
        if (sortParam === 'views') order = 'Most Popular';
        if (sortParam === 'latest') order = 'Latest Update';
        if (searchParams?.get('filter') === 'new') order = 'New Releases';
        setSelectedOrder(order);
    }, [searchParams]);

    const { currentUser } = useStore();

    const dynamicGenres = React.useMemo(() => {
        const all = new Set<string>();
        initialMangas.forEach(m => m.genres?.forEach(g => all.add(g)));
        return ['All', ...Array.from(all).sort()];
    }, [initialMangas]);

    const statuses = ['All', 'Ongoing', 'Completed', 'Hiatus'];
    const types = ['All', 'Manhwa', 'Manga', 'Manhua'];
    const orders = ['Latest Update', 'New Releases', 'Most Popular', 'Top Rated', 'A-Z'];

    const results = React.useMemo(() => {
        let filtered = [...initialMangas] as (Manga & { chapters?: any[] })[];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                m.title.toLowerCase().includes(q) ||
                m.genres?.some(g => g.toLowerCase().includes(q)) ||
                m.author?.toLowerCase().includes(q)
            );
        }
        if (selectedStatus !== 'All') filtered = filtered.filter(m => m.status === selectedStatus);
        if (selectedType !== 'All') filtered = filtered.filter(m => m.type === selectedType);
        if (selectedGenre !== 'All') filtered = filtered.filter(m => m.genres?.includes(selectedGenre));
        if (hideBookmarked && currentUser?.bookmarks) {
            filtered = filtered.filter(m => !currentUser.bookmarks.includes(m.id));
        }

        switch (selectedOrder) {
            case 'Latest Update': filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); break;
            case 'New Releases': filtered.sort((a, b) => new Date((b as any).createdAt || b.updatedAt).getTime() - new Date((a as any).createdAt || a.updatedAt).getTime()); break;
            case 'Most Popular': filtered.sort((a, b) => b.views - a.views); break;
            case 'Top Rated': filtered.sort((a, b) => b.rating - a.rating); break;
            case 'A-Z': filtered.sort((a, b) => a.title.localeCompare(b.title)); break;
        }
        return filtered;
    }, [searchQuery, selectedStatus, selectedType, selectedOrder, selectedGenre, hideBookmarked, initialMangas, currentUser]);

    useEffect(() => { setInputValue(initialQuery); setSearchQuery(initialQuery); }, [initialQuery]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(inputValue)}`);
    };

    return (
        <div className="min-h-[60vh] pt-12 pb-16 px-4 sm:px-8 md:px-16 lg:px-24">
            {/* ── Header Row ── */}
            <div className="flex items-center gap-3 mb-5">
                <h1 className="text-2xl font-extrabold text-white">Browse Series</h1>
                <span className="bg-primary/20 border border-primary/40 text-primary text-xs font-bold px-3 py-1 rounded-full shadow-[0_0_10px_rgba(217,70,239,0.2)]">
                    {results.length}
                </span>
            </div>

            {/* ── Filter Pills ── */}
            <div className="flex flex-wrap items-center gap-2 mb-8 p-3 bg-white/[0.03] border border-white/10 rounded-2xl relative overflow-visible">
                {/* Sort group */}
                <PillButton
                    label={selectedOrder}
                    icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                    options={orders}
                    value={selectedOrder}
                    onChange={setSelectedOrder}
                />

                {/* Visual separator */}
                <div className="w-px h-6 bg-white/10 mx-1" />

                {/* Filter group */}
                <PillButton
                    label="Status"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    options={statuses}
                    value={selectedStatus}
                    onChange={setSelectedStatus}
                />
                <PillButton
                    label="Type"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    options={types}
                    value={selectedType}
                    onChange={setSelectedType}
                />
                <PillButton
                    label="Genres"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    options={dynamicGenres}
                    value={selectedGenre}
                    onChange={setSelectedGenre}
                />

                {/* Visual separator */}
                <div className="w-px h-6 bg-white/10 mx-1" />

                {/* Bookmark toggle */}
                <button
                    onClick={() => setHideBookmarked(v => !v)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200
                        ${hideBookmarked
                            ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                            : 'bg-white/5 border-white/10 text-zinc-300 hover:border-primary/50 hover:text-white'
                        }`}
                >
                    {hideBookmarked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    Hide Bookmarked
                </button>

                {/* Search bar - pushed to the right */}
                <form onSubmit={handleSearch} className="relative ml-auto">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search series..."
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        className="w-80 bg-white/5 border border-white/10 rounded-full pl-10 pr-5 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_12px_rgba(217,70,239,0.15)] transition-all"
                    />
                </form>
            </div>

            {/* ── Results Grid ── */}
            {results.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-8">
                    {results.map(m => <BrowseCard key={m.id} manga={m as Manga & { chapters?: any[] }} />)}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-white glass-card">
                    <Frown className="w-16 h-16 mb-6 opacity-60 text-primary drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]" />
                    <p className="text-xl font-bold">No results found</p>
                    <p className="text-sm mt-2 text-zinc-400">Try adjusting your filters or search query.</p>
                    <button
                        onClick={() => {
                            setInputValue(''); setSearchQuery('');
                            setSelectedStatus('All'); setSelectedType('All');
                            setSelectedGenre('All'); setSelectedOrder('Latest Update');
                            setHideBookmarked(false);
                            router.push('/search');
                        }}
                        className="mt-6 text-primary text-sm font-semibold hover:underline"
                    >
                        Reset Filters
                    </button>
                </div>
            )}
        </div>
    );
};

export default function SearchClient({ initialMangas }: { initialMangas: (Manga & { chapters?: any[] })[] }) {
    return (
        <Suspense fallback={<div className="text-center py-10 text-white">Loading search...</div>}>
            <SearchContent initialMangas={initialMangas} />
        </Suspense>
    );
}
