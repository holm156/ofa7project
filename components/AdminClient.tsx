"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useStore } from '../context/StoreContext';
import { Button, Input, Card, Badge } from './UIComponents';
import { Plus, FileText, Image, Edit2, CheckCircle, LayoutDashboard, Search, Users, Coins, Trash2, Book, Clock, ChevronDown } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Manga, Chapter } from '../types';
import { api } from '../services/api';
import { slugify } from '../lib/slug';
import { getImageUrl } from '../lib/image';
import JSZip from 'jszip';

interface AdminUser {
    id: string;
    username: string;
    name: string;
    email: string;
    coins: number;
    role: string;
    createdAt: string;
}

const COMMON_GENRES = [
    'Action', 'Adventure', 'Fantasy', 'Romance', 'Comedy',
    'Drama', 'Mystery', 'Horror', 'Sci-Fi', 'Slice of Life',
    'Murim', 'System', 'Reincarnation', 'Isekai', 'School Life',
    'Historical', 'Supernatural', 'Psychological', 'Thriller', 'Sports'
];

// Helper component for promo countdown
const PromoCountdown = ({ expiryDate }: { expiryDate: string }) => {
    const [timeLeft, setTimeLeft] = useState<{ d: number, h: number, m: number, s: number } | null>(null);

    React.useEffect(() => {
        const calculate = () => {
            const diff = new Date(expiryDate).getTime() - new Date().getTime();
            if (diff <= 0) return null;

            return {
                d: Math.floor(diff / (1000 * 60 * 60 * 24)),
                h: Math.floor((diff / (1000 * 60 * 60)) % 24),
                m: Math.floor((diff / 1000 / 60) % 60),
                s: Math.floor((diff / 1000) % 60)
            };
        };

        setTimeLeft(calculate());
        const timer = setInterval(() => {
            const res = calculate();
            setTimeLeft(res);
            if (!res) clearInterval(timer);
        }, 1000);

        return () => clearInterval(timer);
    }, [expiryDate]);

    if (!timeLeft) return <span className="text-red-500 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Expired</span>;

    return (
        <span className="text-primary font-bold flex items-center gap-1.5 animate-pulse-slow">
            <Clock className="w-3.5 h-3.5" />
            <span className="flex gap-1 text-[11px] uppercase tracking-tighter">
                {timeLeft.d > 0 && <span>{timeLeft.d}d</span>}
                {timeLeft.h > 0 && <span>{timeLeft.h}h</span>}
                {timeLeft.m > 0 && <span>{timeLeft.m}m</span>}
                {<span>{timeLeft.s}s</span>}
            </span>
        </span>
    );
};

// Helper component for file preview to manage object URLs
const FilePreview = ({ file, onRemove, index }: { file: File, onRemove: () => void, index: number }) => {
    const [url, setUrl] = useState<string>('');

    useEffect(() => {
        const u = URL.createObjectURL(file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [file]);

    return (
        <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-white/5 group bg-zinc-900 shadow-xl">
            {url && <img src={url} className="w-full h-full object-cover" alt="" />}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition-all transform hover:scale-110 shadow-lg"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1 py-0.5 text-[8px] text-white flex justify-between items-center">
                <span className="font-bold text-primary">#{index + 1}</span>
                <span className="truncate opacity-70 ml-1 max-w-[40px]">{file.name}</span>
            </div>
        </div>
    );
};

interface BulkItemType {
    id: string;
    file: File;
    chapterNumber: string;
    chapterTitle: string;
    status: 'pending' | 'extracting' | 'uploading' | 'creating' | 'completed' | 'error';
    progress: number;
    error?: string;
}

interface ChapterPage {
    id: string;
    type: 'url' | 'file';
    content: string | File;
    previewUrl?: string; // Only for files
}

interface AdminClientProps {
    initialMangas: Manga[];
}

export default function AdminClient({ initialMangas }: AdminClientProps) {
    const { currentUser, uploadChapterImages, uploadSingleImage } = useStore();
    const { showToast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');


    const [mangas, setMangas] = useState<Manga[]>(initialMangas);
    const featuredMangaIds = mangas.filter(m => m.isFeatured).map(m => m.id);

    const [activeTab, setActiveTab] = useState<'manga' | 'chapters' | 'slider' | 'users' | 'promo' | 'transactions' | 'analytics' | 'scraper' | 'cleanup'>('manga');

    // Sync activeTab with ?tab= query param
    useEffect(() => {
        if (tabParam && ['manga', 'chapters', 'slider', 'users', 'promo', 'transactions', 'analytics', 'scraper'].includes(tabParam)) {
            setActiveTab(tabParam as any);
        }
    }, [tabParam]);


    // Manga Form State
    const [isEditingManga, setIsEditingManga] = useState(false);
    const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
    const [mangaForm, setMangaForm] = useState({
        title: '', cover: '', backgroundImage: '', description: '', author: '',
        status: 'Ongoing' as 'Ongoing' | 'Completed' | 'Hiatus',
        type: 'Manhwa' as 'Manhwa' | 'Manga' | 'Manhua',
        genres: [] as string[],
        discordRoleId: '',
        releaseYear: '2025',
        views: 0,
        updatedAt: ''
    });
    const [customGenre, setCustomGenre] = useState('');
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [bgFile, setBgFile] = useState<File | null>(null);

    // Chapter Form State
    const [chapterMangaId, setChapterMangaId] = useState('');
    const [chapterTitle, setChapterTitle] = useState('');
    const [chapterNumber, setChapterNumber] = useState('');
    const [chapterUploadMethod, setChapterUploadMethod] = useState<'file' | 'url'>('file');
    const [chapterFiles, setChapterFiles] = useState<File[] | null>(null);
    const [chapterURLs, setChapterURLs] = useState('');

    // --- Bulk Chapter States ---
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkQueue, setBulkQueue] = useState<BulkItemType[]>([]);
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);

    // --- Tab Management ---
    const [isUploading, setIsUploading] = useState(false);
    const [chapterPrice, setChapterPrice] = useState('0');
    const [chapterFreeDate, setChapterFreeDate] = useState('');
    const [chapterSourceName, setChapterSourceName] = useState('');
    const [chapterSourceColor, setChapterSourceColor] = useState('#e11d48');
    const [chapterReleaseDate, setChapterReleaseDate] = useState('');

    const [mangaChapters, setMangaChapters] = useState<Chapter[]>([]);
    const [isLoadingChapters, setIsLoadingChapters] = useState(false);
    const [isEditingChapter, setIsEditingChapter] = useState(false);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

    // Visual Chapter Pages Editor
    const [chapterPages, setChapterPages] = useState<ChapterPage[]>([]);

    // Slider State
    const [sliderSearch, setSliderSearch] = useState('');

    // User Management State
    const [userSearch, setUserSearch] = useState('');
    const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [coinAmount, setCoinAmount] = useState<number>(0);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [showChaptersForUserId, setShowChaptersForUserId] = useState<string | null>(null);
    const [resFilterWidth, setResFilterWidth] = useState('');
    const [resFilterHeight, setResFilterHeight] = useState('');
    const [isCleaningRes, setIsCleaningRes] = useState(false);
    const [cleanupMangaId, setCleanupMangaId] = useState('');
    const [foundImages, setFoundImages] = useState<{ chapterId: string, chapterNumber: number, imageUrl: string, index: number }[]>([]);
    const [isSearchingCleanup, setIsSearchingCleanup] = useState(false);
    const [isCleanupMangaDropdownOpen, setIsCleanupMangaDropdownOpen] = useState(false);
    const [cleanupMangaDropdownSearch, setCleanupMangaDropdownSearch] = useState('');
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

    // Transactions State
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [transactionSearch, setTransactionSearch] = useState('');
    const [transactionStartDate, setTransactionStartDate] = useState('');
    const [transactionEndDate, setTransactionEndDate] = useState('');

    // Manga Search State
    const [mangaSearch, setMangaSearch] = useState('');

    const [isScraperMangaDropdownOpen, setIsScraperMangaDropdownOpen] = useState(false);
    const [scraperMangaDropdownSearch, setScraperMangaDropdownSearch] = useState('');

    // Chapter Search State
    const [chapterSearch, setChapterSearch] = useState('');

    // Dropdown Search State
    const [isMangaDropdownOpen, setIsMangaDropdownOpen] = useState(false);
    const [mangaDropdownSearch, setMangaDropdownSearch] = useState('');

    // Promo Codes State
    const [promoCodes, setPromoCodes] = useState<any[]>([]);
    const [isLoadingPromos, setIsLoadingPromos] = useState(false);
    const [promoForm, setPromoForm] = useState({ code: '', coins: '100', maxUses: '', expiresAt: '' });
    const [expandedPromoId, setExpandedPromoId] = useState<string | null>(null);

    // User Chapters Management
    const [userChapters, setUserChapters] = useState<any[]>([]);
    const [isFetchingChapters, setIsFetchingChapters] = useState(false);

    // Analytics State
    const [stats, setStats] = useState<any>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // Scraper State
    const [scraperUrl, setScraperUrl] = useState('');
    const [isScraperBulkMode, setIsScraperBulkMode] = useState(false);
    const [scraperBulkUrls, setScraperBulkUrls] = useState('');
    const [scraperRangeMode, setScraperRangeMode] = useState(false);
    const [scraperUrlTemplate, setScraperUrlTemplate] = useState('');
    const [scraperRangeStart, setScraperRangeStart] = useState('1');
    const [scraperRangeEnd, setScraperRangeEnd] = useState('10');
    const [scraperMangaId, setScraperMangaId] = useState('');
    const [scraperChapterNumber, setScraperChapterNumber] = useState('');
    const [scraperChapterTitle, setScraperChapterTitle] = useState('');
    const [scraperSourceName, setScraperSourceName] = useState('');
    const [scraperSourceColor, setScraperSourceColor] = useState('#e11d48');
    const [isScraping, setIsScraping] = useState(false);
    const [scraperResult, setScraperResult] = useState<{ images: string[], success?: boolean, bulkResults?: any[] } | null>(null);
    const [expandedBulkIndices, setExpandedBulkIndices] = useState<number[]>([]);
    const [autoPublish, setAutoPublish] = useState(false);
    const [scraperProgress, setScraperProgress] = useState(0);
    const [scraperJobs, setScraperJobs] = useState<any[]>([]);

    // Fetch active jobs periodically
    React.useEffect(() => {
        const fetchJobs = async () => {
            try {
                const res = await fetch('/api/admin/scraper');
                const data = await res.json();
                if (Array.isArray(data)) setScraperJobs(data);
            } catch (e) {
                console.error("Failed to fetch jobs", e);
            }
        };

        if (activeTab === 'scraper') {
            fetchJobs();
            const interval = setInterval(fetchJobs, 10000); // Update every 10s
            return () => clearInterval(interval);
        }
    }, [activeTab]);

    // Auth Check
    React.useEffect(() => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'moderator')) {
            router.replace('/');
        }
    }, [currentUser, router]);

    React.useEffect(() => {
        const fetchChapters = async () => {
            if (!chapterMangaId) {
                setMangaChapters([]);
                return;
            }
            setIsLoadingChapters(true);
            try {
                const chapters = await api.getChapters(chapterMangaId);
                setMangaChapters(chapters || []);
            } catch (error) {
                console.error("Failed to fetch chapters:", error);
                setMangaChapters([]);
            } finally {
                setIsLoadingChapters(false);
            }
        };

        if (activeTab === 'chapters') {
            fetchChapters();
        }
        if (activeTab === 'promo') {
            const fetchPromos = async () => {
                setIsLoadingPromos(true);
                try {
                    const data = await api.getAdminPromoCodes();
                    setPromoCodes(data);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsLoadingPromos(false);
                }
            };
            fetchPromos();
        }
        if (activeTab === 'transactions') {
            const fetchTransactions = async () => {
                setIsLoadingTransactions(true);
                try {
                    const res = await fetch('/api/admin/transactions');
                    if (res.ok) {
                        const data = await res.json();
                        setTransactions(data);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsLoadingTransactions(false);
                }
            };
            fetchTransactions();
        }
        if (activeTab === 'analytics') {
            const fetchStats = async () => {
                setIsLoadingStats(true);
                try {
                    const res = await fetch('/api/admin/stats');
                    if (res.ok) {
                        const data = await res.json();
                        setStats(data);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsLoadingStats(false);
                }
            };
            fetchStats();
        }
    }, [chapterMangaId, activeTab]);

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'moderator')) return <div className="text-center py-20 text-white min-h-screen">Redirecting to home...</div>;

    // --- Manga Handlers ---

    const handleGenreToggle = (genre: string) => {
        setMangaForm(prev => {
            const current = prev.genres;
            if (current.includes(genre)) {
                return { ...prev, genres: current.filter(g => g !== genre) };
            } else {
                return { ...prev, genres: [...current, genre] };
            }
        });
    };

    const addCustomGenre = () => {
        if (customGenre.trim() && !mangaForm.genres.includes(customGenre.trim())) {
            setMangaForm(prev => ({ ...prev, genres: [...prev.genres, customGenre.trim()] }));
            setCustomGenre('');
        }
    };

    const cleanupByResolution = async () => {
        if (!resFilterWidth || !resFilterHeight) {
            showToast('Please enter both width and height', 'error');
            return;
        }

        setIsCleaningRes(true);
        const w = parseInt(resFilterWidth);
        const h = parseInt(resFilterHeight);
        let removedCount = 0;

        const updatedPages = [...chapterPages];
        const indicesToRemove: number[] = [];

        showToast('Scanning images...', 'info');

        for (let i = 0; i < updatedPages.length; i++) {
            const page = updatedPages[i];
            const url = page.type === 'file' ? page.previewUrl : (page.content as string);
            
            if (!url) continue;

            try {
                const dimensions = await new Promise<{w: number, h: number}>((resolve, reject) => {
                    const img = new window.Image();
                    img.onload = () => resolve({ w: img.width, h: img.height });
                    img.onerror = reject;
                    img.src = url;
                });

                if (dimensions.w === w && dimensions.h === h) {
                    indicesToRemove.push(i);
                }
            } catch (e) {
                console.error("Failed to load image for resolution check", url);
            }
        }

        if (indicesToRemove.length > 0) {
            // Remove from end to start to maintain correct indices
            for (let i = indicesToRemove.length - 1; i >= 0; i--) {
                updatedPages.splice(indicesToRemove[i], 1);
                removedCount++;
            }
            setChapterPages(updatedPages);
            showToast(`Removed ${removedCount} images matching ${w}x${h}`, 'success');
        } else {
            showToast('No images found with that resolution', 'info');
        }
        setIsCleaningRes(false);
    };

    const searchResolutionCleanup = async () => {
        if (!cleanupMangaId) {
            showToast('Please select a manga first', 'error');
            return;
        }
        if (!resFilterWidth || !resFilterHeight) {
            showToast('Please enter both width and height', 'error');
            return;
        }

        setIsSearchingCleanup(true);
        setFoundImages([]);
        setScanProgress({ current: 0, total: 0 });
        const w = parseInt(resFilterWidth);
        const h = parseInt(resFilterHeight);

        try {
            const chapters = await api.getChapters(cleanupMangaId);
            if (!chapters || chapters.length === 0) {
                showToast('No chapters found for this manga', 'info');
                setIsSearchingCleanup(false);
                return;
            }

            setScanProgress({ current: 0, total: chapters.length });
            showToast(`Starting scan for ${chapters.length} chapters...`, 'info');
            const found: typeof foundImages = [];

            // We process chapters sequentially to avoid overloading the browser
            for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
                const ch = chapters[chIdx];
                setScanProgress(prev => ({ ...prev, current: chIdx + 1 }));

                const pages = typeof ch.pages === 'string' ? JSON.parse(ch.pages) : ch.pages;
                if (!Array.isArray(pages)) continue;

                // Process pages in small batches to maintain UI responsiveness
                for (let i = 0; i < pages.length; i++) {
                    const url = getImageUrl(pages[i]);
                    try {
                        const dims = await new Promise<{w: number, h: number}>((resolve, reject) => {
                            const img = new window.Image();
                            const timeout = setTimeout(() => {
                                img.src = ""; // Stop loading
                                reject(new Error("Timeout"));
                            }, 5000); // 5s timeout per image

                            img.onload = () => {
                                clearTimeout(timeout);
                                resolve({ w: img.width, h: img.height });
                            };
                            img.onerror = () => {
                                clearTimeout(timeout);
                                reject(new Error("Load fail"));
                            };
                            img.src = url;
                        });

                        if (dims.w === w && dims.h === h) {
                            found.push({
                                chapterId: ch.id,
                                chapterNumber: ch.number,
                                imageUrl: pages[i],
                                index: i
                            });
                        }
                    } catch (e) {
                        // Skip broken images
                        console.warn(`Skipping image ${url} due to load error`);
                    }
                }
            }

            setFoundImages(found);
            showToast(`Found ${found.length} matching images`, 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to scan chapters', 'error');
        } finally {
            setIsSearchingCleanup(false);
        }
    };

    const deleteFoundImage = async (img: { chapterId: string, imageUrl: string }) => {
        if (!confirm('Are you sure you want to remove this image from its chapter?')) return;

        try {
            // This requires a custom API call or a sequence of get/update chapter
            const chRes = await fetch(`/api/chapter/${img.chapterId}`);
            const ch = await chRes.json();
            
            const pages = Array.isArray(ch.pages) ? ch.pages : JSON.parse(ch.pages);
            const updatedPages = pages.filter((p: string) => p !== img.imageUrl);
            
            await api.updateChapter(img.chapterId, { pages: updatedPages });
            
            // Delete from S3/Wasabi if it's a local file
            if (img.imageUrl.startsWith('/')) {
                api.deleteFile(img.imageUrl).catch(console.error);
            }

            setFoundImages(prev => prev.filter(p => p.imageUrl !== img.imageUrl));
            showToast('Image removed successfully', 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to remove image', 'error');
        }
    };

    const deleteAllFoundImages = async () => {
        if (!confirm(`Are you sure you want to delete ALL ${foundImages.length} found images? This cannot be undone.`)) return;

        showToast('Deleting images...', 'info');
        let successCount = 0;

        // Group by chapter to minimize update calls
        const byChapter: { [id: string]: string[] } = {};
        foundImages.forEach(img => {
            if (!byChapter[img.chapterId]) byChapter[img.chapterId] = [];
            byChapter[img.chapterId].push(img.imageUrl);
        });

        for (const [chId, urls] of Object.entries(byChapter)) {
            try {
                const chRes = await fetch(`/api/chapter/${chId}`);
                const ch = await chRes.json();
                const pages = Array.isArray(ch.pages) ? ch.pages : JSON.parse(ch.pages);
                const updatedPages = pages.filter((p: string) => !urls.includes(p));
                
                await api.updateChapter(chId, { pages: updatedPages });
                
                // Cleanup files
                urls.forEach(url => {
                    if (url.startsWith('/')) api.deleteFile(url).catch(console.error);
                });
                
                successCount += urls.length;
            } catch (e) {
                console.error(`Failed to update chapter ${chId}`, e);
            }
        }

        setFoundImages([]);
        showToast(`Successfully deleted ${successCount} images`, 'success');
    };

    const handleMangaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            let coverUrl = mangaForm.cover;
            let bgUrl = mangaForm.backgroundImage;

            const mangaSlug = slugify(mangaForm.title) || 'unknown';

            if (coverFile) {
                const folder = `uploads/covers/${mangaSlug}`;
                const uploaded = await uploadSingleImage(coverFile, folder);
                if (uploaded) coverUrl = uploaded;
            }

            if (bgFile) {
                const folder = `uploads/backgrounds/${mangaSlug}`;
                const uploaded = await uploadSingleImage(bgFile, folder);
                if (uploaded) bgUrl = uploaded;
            }

            if (!coverUrl) {
                showToast('Cover image is required (URL or File)', 'error');
                return;
            }

            const payload = {
                ...mangaForm,
                cover: coverUrl,
                backgroundImage: bgUrl,
                genres: mangaForm.genres,
                releaseYear: mangaForm.releaseYear || '2025',
                views: Number(mangaForm.views),
                updatedAt: mangaForm.updatedAt ? new Date(mangaForm.updatedAt).toISOString() : undefined
            };

            if (isEditingManga && selectedManga) {
                const targetId = selectedManga.id;
                const updated = await api.updateManga(targetId, payload as any) as Manga;

                // Cleanup old images if they were replaced
                if (coverFile && selectedManga.cover && selectedManga.cover !== updated.cover) {
                    if (selectedManga.cover.startsWith('/')) {
                        api.deleteFile(selectedManga.cover).catch(console.error);
                    }
                }
                if (bgFile && selectedManga.backgroundImage && selectedManga.backgroundImage !== updated.backgroundImage) {
                    if (selectedManga.backgroundImage.startsWith('/')) {
                        api.deleteFile(selectedManga.backgroundImage).catch(console.error);
                    }
                }

                setMangas(prev => prev.map(m => m.id === targetId ? updated : m));
                setIsEditingManga(false);
                setSelectedManga(null);
                showToast('Manga updated successfully', 'success');
            } else {
                const created = await api.createManga(payload as any);
                if (created) {
                    setMangas(prev => [created, ...prev]);
                    showToast('Manga added successfully', 'success');
                }
            }

            // Reset
            setMangaForm({ title: '', cover: '', backgroundImage: '', description: '', author: '', status: 'Ongoing', type: 'Manhwa', genres: [], discordRoleId: '', releaseYear: '2024', views: 0, updatedAt: '' });
            setCoverFile(null);
            setBgFile(null);
            const coverInput = document.getElementById('cover-file') as HTMLInputElement;
            if (coverInput) coverInput.value = '';
            const bgInput = document.getElementById('bg-file') as HTMLInputElement;
            if (bgInput) bgInput.value = '';

        } catch (e: any) {
            console.error(e);
            showToast(e.message || 'Failed to save manga', 'error');
        }
    };

    const handleEditManga = (manga: Manga) => {
        setIsEditingManga(true);
        setSelectedManga(manga);
        setMangaForm({
            title: manga.title,
            cover: manga.cover,
            backgroundImage: manga.backgroundImage || '',
            description: manga.description,
            author: manga.author,
            status: manga.status as any,
            type: manga.type as any,
            genres: manga.genres,
            discordRoleId: manga.discordRoleId || '',
            releaseYear: manga.releaseYear || '2024',
            views: manga.views,
            updatedAt: manga.updatedAt ? new Date(manga.updatedAt).toISOString().slice(0, 16) : ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };


    const handleDeleteManga = async (mangaId: string) => {
        if (currentUser?.role !== 'admin') {
            showToast('Only admins can delete manga', 'error');
            return;
        }
        if (!confirm('Are you sure you want to delete this manga? ALL chapters and data will be lost!')) return;

        try {
            await api.deleteManga(mangaId);
            setMangas(prev => prev.filter(m => m.id !== mangaId));
            showToast('Manga deleted successfully', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to delete manga', 'error');
        }
    };


    // --- Bulk Upload Helpers ---

    const extractNumberFromFilename = (name: string): string => {
        // Matches common patterns like Ch.15, Chapter 15, Chapter_15, or just 15
        const match = name.match(/(?:ch(?:apter)?[\s._-]?)?(\d+(?:\.\d+)?)/i);
        return match ? match[1] : '';
    };

    const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newItems: BulkItemType[] = files.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            chapterNumber: extractNumberFromFilename(file.name),
            chapterTitle: '',
            status: 'pending',
            progress: 0
        }));

        setBulkQueue(prev => [...prev, ...newItems]);
        e.target.value = '';
    };

    const updateBulkItem = (id: string, updates: Partial<BulkItemType>) => {
        setBulkQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const removeBulkItem = (id: string) => {
        if (isProcessingBulk) return;
        setBulkQueue(prev => prev.filter(item => item.id !== id));
    };

    const processBulkQueue = async () => {
        if (isProcessingBulk || bulkQueue.length === 0) return;
        if (!chapterMangaId) {
            showToast('Please select a manga first', 'error');
            return;
        }

        const manga = mangas.find(m => m.id === chapterMangaId);
        if (!manga) return;

        setIsProcessingBulk(true);

        const pendingItems = bulkQueue.filter(item => item.status === 'pending' || item.status === 'error');

        for (const item of pendingItems) {
            try {
                // 1. Extracting
                updateBulkItem(item.id, { status: 'extracting', progress: 10 });
                const zip = new JSZip();
                const contents = await zip.loadAsync(item.file);
                const extractedFiles: File[] = [];

                for (const [filename, zipEntry] of Object.entries(contents.files)) {
                    if (!zipEntry.dir && filename.match(/\.(jpe?g|png|webp|gif)$/i)) {
                        const blob = await zipEntry.async('blob');
                        extractedFiles.push(new File([blob], filename, { type: blob.type || 'image/jpeg' }));
                    }
                }

                extractedFiles.sort((a, b) => {
                    const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
                    const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
                    return numA - numB;
                });

                if (extractedFiles.length === 0) throw new Error("No images found in ZIP");

                // 2. Uploading
                updateBulkItem(item.id, { status: 'uploading', progress: 40 });
                const finalPages = await uploadChapterImages(extractedFiles, manga.id, manga.title, Number(item.chapterNumber));

                // 3. Creating
                updateBulkItem(item.id, { status: 'creating', progress: 80 });
                const payload = {
                    title: item.chapterTitle || `Chapter ${item.chapterNumber}`,
                    number: Number(item.chapterNumber),
                    pages: finalPages,
                    price: Number(chapterPrice),
                    freeDate: chapterFreeDate ? new Date(chapterFreeDate).toISOString() : undefined,
                    sourceName: chapterSourceName,
                    sourceColor: chapterSourceColor,
                    mangaId: manga.id
                };

                const created = await api.createChapter(payload);
                if (created) {
                    setMangaChapters(prev => [created, ...prev]);
                    updateBulkItem(item.id, { status: 'completed', progress: 100 });
                }
            } catch (err: any) {
                console.error(`Bulk upload failed for ${item.file.name}`, err);
                updateBulkItem(item.id, { status: 'error', error: err.message || 'Failed' });
            }
        }

        setIsProcessingBulk(false);
        showToast('Bulk upload process finished', 'info');
    };

    // --- Chapter Handlers ---

    const processFiles = async (files: File[]) => {
        if (files.length === 0) return;

        setIsUploading(true);
        const processedFiles: File[] = [];

        try {
            for (const file of files) {
                if (file.name.endsWith('.zip')) {
                    showToast('Extracting ZIP file...', 'info');
                    const zip = new JSZip();
                    const contents = await zip.loadAsync(file);

                    const extractedFiles: File[] = [];
                    for (const [filename, zipEntry] of Object.entries(contents.files)) {
                        if (!zipEntry.dir && filename.match(/\.(jpe?g|png|webp|gif)$/i)) {
                            const blob = await zipEntry.async('blob');
                            const extractedFile = new File([blob], filename, { type: blob.type || 'image/jpeg' });
                            extractedFiles.push(extractedFile);
                        }
                    }

                    extractedFiles.sort((a, b) => {
                        const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
                        const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
                        return numA - numB;
                    });

                    processedFiles.push(...extractedFiles);
                    showToast(`Extracted ${extractedFiles.length} images from ZIP`, 'success');
                } else {
                    processedFiles.push(file);
                }
            }
            addFilesToPages(processedFiles);
        } catch (err) {
            console.error("ZIP extraction failed", err);
            showToast('Failed to process file selection', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const addFilesToPages = (files: File[]) => {
        const newPages: ChapterPage[] = files.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            type: 'file',
            content: file,
            previewUrl: URL.createObjectURL(file)
        }));
        setChapterPages(prev => [...prev, ...newPages]);
    };

    const movePage = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= chapterPages.length) return;
        const updated = [...chapterPages];
        const temp = updated[index];
        updated[index] = updated[newIndex];
        updated[newIndex] = temp;
        setChapterPages(updated);
    };

    const removePage = (index: number) => {
        setChapterPages(prev => {
            const updated = [...prev];
            const item = updated[index];
            if (item.type === 'file' && item.previewUrl) {
                URL.revokeObjectURL(item.previewUrl);
            }
            updated.splice(index, 1);
            return updated;
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        processFiles(files);
        e.target.value = '';
    };

    const removeChapterFile = (index: number) => {
        removePage(index);
    };

    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        processFiles(files);
    };

    const handleChapterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!chapterMangaId) {
            showToast('Please select a manga', 'error');
            return;
        }

        setIsUploading(true);
        try {
            const manga = mangas.find(m => m.id === chapterMangaId);
            if (!manga) {
                showToast('Manga not found', 'error');
                setIsUploading(false);
                return;
            }

            let finalPages: string[] = [];

            if (chapterUploadMethod === 'file') {
                if (chapterPages.length === 0) {
                    showToast('Please add some pages', 'error');
                    setIsUploading(false);
                    return;
                }

                const mangaSlug = slugify(manga.title) || 'unknown';
                const chapterFolder = `uploads/chapters/${mangaSlug}/${chapterNumber.replace('.', '_')}_${Math.random().toString(36).substr(2, 6)}`;

                for (const page of chapterPages) {
                    if (page.type === 'file') {
                        const uploaded = await uploadSingleImage(page.content as File, chapterFolder);
                        if (uploaded) {
                            finalPages.push(uploaded);
                        } else {
                            throw new Error("Failed to upload one of the images");
                        }
                    } else {
                        // Already a URL, just push it
                        finalPages.push(page.content as string);
                    }
                }
            } else {
                if (!chapterURLs.trim()) {
                    showToast('Please enter image URLs', 'error');
                    setIsUploading(false);
                    return;
                }
                finalPages = chapterURLs.split('\n').map(u => u.trim()).filter(Boolean);
            }

            if (finalPages.length === 0) throw new Error("No valid pages found");

                const payload = {
                    title: chapterTitle || `Chapter ${chapterNumber}`,
                    number: Number(chapterNumber),
                    pages: finalPages,
                    price: Number(chapterPrice),
                    freeDate: chapterFreeDate ? new Date(chapterFreeDate).toISOString() : undefined,
                    sourceName: chapterSourceName,
                    sourceColor: chapterSourceColor,
                    releaseDate: chapterReleaseDate ? new Date(chapterReleaseDate).toISOString() : undefined,
                    mangaId: chapterMangaId
                };

            if (isEditingChapter && selectedChapter) {
                const updated = await api.updateChapter(selectedChapter.id, payload);
                setMangaChapters(prev => prev.map(c => c.id === selectedChapter.id ? updated : c));
                showToast('Chapter updated successfully', 'success');
                setIsEditingChapter(false);
                setSelectedChapter(null);
                setChapterPages([]);
            } else {
                const created = await api.createChapter(payload);
                if (created) {
                    setMangaChapters(prev => [created, ...prev]);
                    showToast('Chapter published successfully', 'success');
                    setChapterPages([]);
                }
            }

            // Reset
            setChapterTitle('');
            setChapterNumber('');
            setChapterFiles(null);
            setChapterURLs('');
            setChapterPrice('0');
            setChapterFreeDate('');
            setChapterSourceName('');
            setChapterSourceColor('#e11d48');
            setChapterReleaseDate('');
            if (chapterUploadMethod === 'file') {
                const fileInput = document.getElementById('chapter-files') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            }

        } catch (e: any) {
            console.error(e);
            showToast(e.message || 'Failed to manage chapter', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleEditChapter = (chapter: Chapter) => {
        if (currentUser?.role !== 'admin') {
            showToast('Only admins can edit chapters', 'error');
            return;
        }
        setIsEditingChapter(true);
        setSelectedChapter(chapter);
        setChapterMangaId(chapter.mangaId);
        setChapterTitle(chapter.title);
        setChapterNumber(chapter.number.toString());
        setChapterPrice(chapter.price.toString());
        setChapterSourceName(chapter.sourceName || '');
        setChapterSourceColor(chapter.sourceColor || '#e11d48');
        setChapterReleaseDate(chapter.releaseDate ? new Date(chapter.releaseDate).toISOString().slice(0, 16) : '');

        // Correctly format the UTC date to local time for the datetime-local input
        if (chapter.freeDate) {
            const d = new Date(chapter.freeDate);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            setChapterFreeDate(d.toISOString().slice(0, 16));
        } else {
            setChapterFreeDate('');
        }

        // Load existing pages into the visual editor safely
        let parsedPages: string[] = [];
        try {
            parsedPages = typeof chapter.pages === 'string' ? JSON.parse(chapter.pages) : (chapter.pages || []);
        } catch (e) {
            console.error('Failed to parse chapter pages:', e);
            parsedPages = Array.isArray(chapter.pages) ? chapter.pages : [];
        }

        const existingPages: ChapterPage[] = parsedPages.map((url: string) => ({
            id: Math.random().toString(36).substr(2, 9),
            type: 'url',
            content: getImageUrl(url)
        }));
        setChapterPages(existingPages);

        setChapterUploadMethod('file'); // Default to file/visual mode when editing now
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteChapter = async (chapterId: string) => {
        if (currentUser?.role !== 'admin') {
            showToast('Only admins can delete chapters', 'error');
            return;
        }
        if (!confirm('Are you sure you want to delete this chapter?')) return;
        try {
            await api.deleteChapter(chapterId);
            setMangaChapters(prev => prev.filter(c => c.id !== chapterId));
            showToast('Chapter deleted successfully', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to delete chapter', 'error');
        }
    };

    const handleScraper = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isScraperBulkMode && !scraperUrl) return;
        if (isScraperBulkMode && !scraperRangeMode && !scraperBulkUrls.trim()) return;
        if (isScraperBulkMode && scraperRangeMode && !scraperUrlTemplate) return;

        setIsScraping(true);
        setScraperResult(null);
        setScraperProgress(0);

        const urls = isScraperBulkMode
            ? (scraperRangeMode
                ? Array.from({ length: Math.abs((parseInt(scraperRangeEnd) || 0) - (parseInt(scraperRangeStart) || 0)) + 1 }, (_, i) => {
                    const start = parseInt(scraperRangeStart) || 1;
                    const end = parseInt(scraperRangeEnd) || 1;
                    const ch = Math.min(start, end) + i;
                    return scraperUrlTemplate.replace(/{ch}/g, ch.toString());
                })
                : scraperBulkUrls.split('\n').map(u => u.trim()).filter(Boolean))
            : [scraperUrl];

        if (urls.length === 0 || !urls[0]) {
            showToast('Please provide a valid URL or template', 'error');
            setIsScraping(false);
            return;
        }

        // Progress simulation for bulk mode
        let progressInterval: any;
        if (isScraperBulkMode) {
            const totalItems = urls.length;
            const estimatedTimePerItem = 2500; // 1s delay + approx 1.5s for processing
            let currentProgress = 0;

            progressInterval = setInterval(() => {
                currentProgress += (100 / (totalItems * (estimatedTimePerItem / 100)));
                if (currentProgress >= 98) {
                    clearInterval(progressInterval);
                    setScraperProgress(99);
                } else {
                    setScraperProgress(Math.round(currentProgress));
                }
            }, 100);
        } else {
            // Single URL progress
            let currentProgress = 0;
            progressInterval = setInterval(() => {
                currentProgress += 5;
                if (currentProgress >= 90) {
                    clearInterval(progressInterval);
                } else {
                    setScraperProgress(currentProgress);
                }
            }, 200);
        }

        try {
            const res = await fetch('/api/admin/scraper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls,
                    mangaId: scraperMangaId,
                    chapterNumber: scraperChapterNumber,
                    chapterTitle: scraperChapterTitle,
                    sourceName: scraperSourceName,
                    sourceColor: scraperSourceColor,
                    autoPublish,
                    isBulk: isScraperBulkMode
                })
            });

            const initData = await res.json();
            
            if (!res.ok) {
                if (progressInterval) clearInterval(progressInterval);
                showToast(initData.error || 'Failed to start scraper', 'error');
                setIsScraping(false);
                return;
            }

            const jobId = initData.jobId;
            showToast('Scraper started in background...', 'info');

            // --- Polling Logic ---
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`/api/admin/scraper?jobId=${jobId}`);
                    const job = await statusRes.json();

                    if (!statusRes.ok) throw new Error(job.error || 'Failed to poll status');

                    setScraperProgress(job.progress);

                    if (job.status === 'completed') {
                        clearInterval(pollInterval);
                        if (progressInterval) clearInterval(progressInterval);
                        setScraperProgress(100);
                        setIsScraping(false);

                        const data = job.results;
                        setScraperResult(data);
                        setExpandedBulkIndices([]);
                        showToast(data.success ? 'Process finished successfully!' : 'Images extracted!', 'success');
                        
                        if (data.success) {
                            setScraperUrl('');
                            setScraperBulkUrls('');
                            setScraperChapterNumber('');
                            setScraperChapterTitle('');
                            setScraperSourceName('');
                            setScraperSourceColor('#e11d48');
                        }
                    } else if (job.status === 'failed') {
                        clearInterval(pollInterval);
                        if (progressInterval) clearInterval(progressInterval);
                        setIsScraping(false);
                        showToast(job.error || 'Scraping failed in background', 'error');
                    }
                } catch (pollErr: any) {
                    console.error("Polling error:", pollErr);
                    clearInterval(pollInterval);
                    if (progressInterval) clearInterval(progressInterval);
                    setIsScraping(false);
                    showToast('Lost connection to scraper job status', 'error');
                }
            }, 3000); // Poll every 3 seconds

        } catch (err) {
            console.error(err);
            if (progressInterval) clearInterval(progressInterval);
            setIsScraping(false);
            showToast('Failed to connect to scraper', 'error');
        }
    };

    // --- Slider Handlers ---
    const toggleFeatured = async (mangaId: string) => {
        const manga = mangas.find(m => m.id === mangaId);
        if (!manga) return;

        const isCurrentlyFeatured = manga.isFeatured;

        if (!isCurrentlyFeatured && featuredMangaIds.length >= 25) {
            showToast('Max 25 items in slider', 'error');
            return;
        }

        try {
            if (currentUser?.role !== 'admin') {
                showToast('Only admins can change featured status', 'error');
                return;
            }
            const updated = await api.updateManga(manga.id, { isFeatured: !isCurrentlyFeatured } as any);
            setMangas(prev => prev.map(m => m.id === manga.id ? updated : m));
        } catch (e) {
            console.error(e);
            showToast('Failed to update featured status', 'error');
        }
    };

    const filteredSliderMangas = mangas.filter(m =>
        m?.title?.toLowerCase().includes(sliderSearch.toLowerCase())
    );

    // --- User Management Handlers ---
    const handleUserSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userSearch.trim()) return;

        setIsSearchingUsers(true);
        try {
            const res = await fetch(`/api/admin/users?q=${encodeURIComponent(userSearch)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
                setSelectedUserId(null); // Reset selection on new search
            } else {
                showToast('Failed to search users', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Search error', 'error');
        } finally {
            setIsSearchingUsers(false);
        }
    };

    const handleManageCoins = async (userId: string, amount: number, action: 'add' | 'deduct' | 'set') => {
        if (amount <= 0 && action !== 'set') {
            showToast('Enter a valid amount', 'error');
            return;
        }
        if (amount < 0 && action === 'set') {
            showToast('Amount cannot be negative', 'error');
            return;
        }

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, amount, action })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(data.message, 'success');
                // Update local state to reflect new balance
                setSearchResults(prev => prev.map(u =>
                    u.id === userId ? { ...u, coins: data.newBalance } : u
                ));
                setSelectedUserId(null);
                setCoinAmount(0);
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to manage coins', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error managing coins', 'error');
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!confirm(`Are you sure you want to change the role to ${newRole}?`)) return;

        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(data.message, 'success');
                // Update local state
                setSearchResults(prev => prev.map(u =>
                    u.id === userId ? { ...u, role: data.newRole } : u
                ));
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to update role', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error updating role', 'error');
        }
    };

    const handlePromoSubmit = async (e: React.FormEvent) => {

        e.preventDefault();
        try {
            const created = await api.createPromoCode(promoForm);
            setPromoCodes(prev => [created, ...prev]);
            showToast('Promo code created', 'success');
            setPromoForm({ code: '', coins: '100', maxUses: '', expiresAt: '' });
        } catch (e: any) {
            showToast(e.message || 'Failed to create promo code', 'error');
        }
    };

    const handleDeletePromo = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await api.deletePromoCode(id);
            setPromoCodes(prev => prev.filter(p => p.id !== id));
            showToast('Promo code deleted', 'success');
        } catch (e) {
            showToast('Failed to update coins', 'error');
        }
    };

    const fetchUserChapters = async (userId: string) => {
        setIsFetchingChapters(true);
        try {
            const res = await fetch(`/api/admin/users/${userId}/chapters`);
            if (!res.ok) throw new Error('Failed to fetch chapters');
            const data = await res.json();
            setUserChapters(data);
            setShowChaptersForUserId(userId);
        } catch (e: any) {
            showToast('Failed to fetch user chapters', 'error');
        } finally {
            setIsFetchingChapters(false);
        }
    };

    const handleRemoveChapter = async (userId: string, chapterId: string) => {
        if (!confirm('Are you sure you want to remove this chapter from the user\'s library?')) return;

        try {
            const res = await fetch(`/api/admin/users/${userId}/chapters?chapterId=${chapterId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to remove chapter');

            showToast('Chapter removed successfully', 'success');
            // Update local state
            setUserChapters(prev => prev.filter(c => c.chapterId !== chapterId));
        } catch (e: any) {
            showToast('Failed to remove chapter', 'error');
        }
    };

    const exportTransactionsToCSV = () => {
        const filtered = transactions.filter(t => {
            const matchesSearch = t.user?.username?.toLowerCase().includes(transactionSearch.toLowerCase()) ||
                t.user?.email?.toLowerCase().includes(transactionSearch.toLowerCase()) ||
                t.description?.toLowerCase().includes(transactionSearch.toLowerCase());

            const tDate = new Date(t.createdAt);
            const matchesStart = transactionStartDate ? tDate >= new Date(transactionStartDate) : true;
            // End date should include the full day
            const endDatePlusOne = transactionEndDate ? new Date(new Date(transactionEndDate).setHours(23, 59, 59, 999)) : null;
            const matchesEnd = endDatePlusOne ? tDate <= endDatePlusOne : true;

            return matchesSearch && matchesStart && matchesEnd;
        });

        const headers = ["User", "Email", "Amount", "Balance After", "Type", "Description", "Date"];
        const rows = filtered.map(t => [
            t.user?.username || 'Unknown',
            t.user?.email || '',
            t.amount,
            t.balanceAfter || 0,
            t.type,
            (t.description || '').replace(/,/g, ';'), // Escape commas for CSV
            new Date(t.createdAt).toLocaleString()
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `legion-transactions-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-primary" /> Admin Dashboard
                    </h1>
                    <p className="text-zinc-500">Manage content and system settings</p>
                </div>
            </div>

            <div className="flex gap-2 mb-8 bg-surface p-1 rounded-xl border border-white/5 w-fit overflow-x-auto max-w-full">
                {(['manga', 'chapters', 'scraper', currentUser?.role === 'admin' ? 'slider' : null, currentUser?.role === 'admin' ? 'users' : null, currentUser?.role === 'admin' ? 'promo' : null, currentUser?.role === 'admin' ? 'transactions' : null, currentUser?.role === 'admin' ? 'analytics' : null, currentUser?.role === 'admin' ? 'cleanup' : null].filter(Boolean) as ('manga' | 'chapters' | 'scraper' | 'slider' | 'users' | 'promo' | 'transactions' | 'analytics' | 'cleanup')[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === tab
                            ? 'bg-primary text-black shadow-lg shadow-primary/20'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab === 'scraper' ? 'Auto Scraper' : tab === 'cleanup' ? 'Resolution Cleanup' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            <div className="py-6">
                {/* ANALYTICS TAB */}
                {activeTab === 'analytics' && currentUser?.role === 'admin' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {isLoadingStats ? (
                            <div className="py-24 text-center bg-surface/30 rounded-2xl border border-dashed border-white/5">
                                <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-zinc-500 italic">Loading advanced statistics...</p>
                            </div>
                        ) : stats && (
                            <>
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <Card className="p-6 bg-primary/5 border-primary/10">
                                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Total Revenue</p>
                                        <h3 className="text-3xl font-black text-primary flex items-center gap-2">
                                            {stats.revenue.totalPurchased} <span className="text-sm font-bold opacity-50">Coins</span>
                                        </h3>
                                        <p className="text-[10px] text-zinc-600 mt-2">Total coins ever purchased</p>
                                    </Card>

                                    <Card className="p-6 bg-blue-500/5 border-blue-500/10">
                                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Total Users</p>
                                        <h3 className="text-3xl font-black text-blue-400 flex items-center gap-2">
                                            {stats.users.total} <Users className="w-5 h-5 opacity-50" />
                                        </h3>
                                        <p className="text-[10px] text-green-500 font-bold mt-2">+{stats.users.new30d} New (30d)</p>
                                    </Card>

                                    <Card className="p-6 bg-rose-500/5 border-rose-500/10">
                                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Active Economy</p>
                                        <h3 className="text-3xl font-black text-rose-500 flex items-center gap-2">
                                            {stats.revenue.totalSpent} <Coins className="w-5 h-5 opacity-50" />
                                        </h3>
                                        <p className="text-[10px] text-zinc-600 mt-2">Total coins spent on chapters</p>
                                    </Card>

                                    <Card className="p-6 bg-zinc-800/20 border-white/5">
                                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Content Stats</p>
                                        <h3 className="text-3xl font-black text-white flex items-center gap-2">
                                            {stats.content.totalChapters} <Book className="w-5 h-5 opacity-50" />
                                        </h3>
                                        <p className="text-[10px] text-zinc-600 mt-2">{stats.content.totalUnlocks} Total downloads/unlocks</p>
                                    </Card>
                                </div>

                                {/* Top Manga Section */}
                                <div>
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                                        <Badge color="bg-primary/20 text-primary border-primary/20">Hot</Badge>
                                        Most Viewed Manga (Top 5)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        {stats.topManga.map((m: any, idx: number) => (
                                            <div key={idx} className="bg-surface rounded-xl border border-white/5 overflow-hidden hover:border-primary/30 transition-all group relative">
                                                <div className="absolute top-2 left-2 z-10 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-black text-primary border border-primary/20 shadow-xl">
                                                    #{idx + 1}
                                                </div>
                                                <div className="aspect-[2/3] relative">
                                                    <img src={getImageUrl(m.cover)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                                                    <div className="absolute bottom-2 left-2 right-2">
                                                        <p className="text-xs font-bold text-white line-clamp-1">{m.title}</p>
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                                            <span className="text-[10px] text-zinc-400 font-bold">{m.views} Views</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* RESOLUTION CLEANUP TAB */}
                {activeTab === 'cleanup' && currentUser?.role === 'admin' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Control Panel */}
                            <Card className="p-8 bg-black/40 border-primary/10 lg:col-span-1">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                        <Search className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Image Scanner</h2>
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Find images by resolution</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2.5 ml-1">Target Manga</label>
                                        <div className="relative">
                                            <div
                                                onClick={() => setIsCleanupMangaDropdownOpen(!isCleanupMangaDropdownOpen)}
                                                className="w-full px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-white cursor-pointer flex justify-between items-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            >
                                                <span className={cleanupMangaId ? "text-white" : "text-zinc-500"}>
                                                    {cleanupMangaId ? mangas.find(m => m.id === cleanupMangaId)?.title : 'Select Manga to Scan'}
                                                </span>
                                                <ChevronDown className="w-4 h-4 text-zinc-500" />
                                            </div>
                                            {isCleanupMangaDropdownOpen && (
                                                <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-[300px] flex flex-col overflow-hidden backdrop-blur-xl">
                                                    <div className="p-3 border-b border-zinc-800">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-primary"
                                                            placeholder="Search manga..."
                                                            value={cleanupMangaDropdownSearch}
                                                            onChange={e => setCleanupMangaDropdownSearch(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="overflow-y-auto p-2 custom-scrollbar">
                                                        {mangas.filter(m => m.title.toLowerCase().includes(cleanupMangaDropdownSearch.toLowerCase())).map(m => (
                                                            <div
                                                                key={m.id}
                                                                className={`px-3 py-2.5 text-xs cursor-pointer rounded-lg transition-colors ${cleanupMangaId === m.id ? 'bg-primary/20 text-primary font-bold' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                                                                onClick={() => {
                                                                    setCleanupMangaId(m.id);
                                                                    setIsCleanupMangaDropdownOpen(false);
                                                                }}
                                                            >
                                                                {m.title}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Width (px)</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                                                value={resFilterWidth}
                                                onChange={e => setResFilterWidth(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Height (px)</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                                                value={resFilterHeight}
                                                onChange={e => setResFilterHeight(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={searchResolutionCleanup}
                                        disabled={isSearchingCleanup || !cleanupMangaId}
                                        className="w-full py-4 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                                    >
                                        {isSearchingCleanup ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    Scanning {scanProgress.current}/{scanProgress.total} <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                </div>
                                                <div className="w-full max-w-[200px] h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-white transition-all duration-300" 
                                                        style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>Start Scanning <Search className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </div>
                            </Card>

                            {/* Results Grid */}
                            <Card className="p-8 bg-black/40 border-zinc-800 lg:col-span-2 min-h-[600px] flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Scan Results</h2>
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{foundImages.length} images matching criteria</p>
                                    </div>
                                    {foundImages.length > 0 && (
                                        <button
                                            onClick={deleteAllFoundImages}
                                            className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/20 transition-all"
                                        >
                                            Delete All Matches
                                        </button>
                                    )}
                                </div>

                                {isSearchingCleanup ? (
                                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-50">
                                        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                        <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Deep scanning images...</p>
                                    </div>
                                ) : foundImages.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6 overflow-y-auto pr-2 custom-scrollbar max-h-[700px]">
                                        {foundImages.map((img, idx) => (
                                            <div key={idx} className="relative group aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-zinc-900 shadow-2xl transition-all hover:border-primary/50">
                                                <img src={getImageUrl(img.imageUrl)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all p-3 flex flex-col justify-end">
                                                    <p className="text-[10px] font-black text-primary uppercase mb-1">Chapter {img.chapterNumber}</p>
                                                    <p className="text-[8px] text-zinc-400 truncate mb-3">Page Index: {img.index + 1}</p>
                                                    <button
                                                        onClick={() => deleteFoundImage(img)}
                                                        className="w-full py-2 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[9px] font-black text-white">
                                                    #{idx + 1}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                                        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 border border-white/5">
                                            <Image className="w-10 h-10 text-zinc-600" />
                                        </div>
                                        <p className="text-sm font-black text-zinc-500 uppercase tracking-widest">No images found</p>
                                        <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-widest">Select a manga and resolution to scan</p>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>
                )}
                {/* MANGA MANAGEMENT TAB */}
                {activeTab === 'manga' && (
                    <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-700">
                        {/* Form */}
                        <Card className="p-8 bg-zinc-950/40 border-white/5 backdrop-blur-xl relative overflow-hidden group h-fit">
                            {/* Decorative background glow */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/20 transition-colors duration-700" />
                            
                            <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-white tracking-tight">
                                <div className="p-2 bg-primary/20 rounded-lg">
                                    <Plus className="w-6 h-6 text-primary" />
                                </div>
                                {isEditingManga ? 'Edit Manga' : 'Add New Manga'}
                            </h2>
                            {currentUser?.role !== 'admin' ? (
                                <div className="bg-zinc-900/50 rounded-xl p-6 text-center border border-dashed border-zinc-800">
                                    <p className="text-zinc-500 text-sm italic">Only administrators can add or edit manga.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleMangaSubmit} className="space-y-8">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Left Column: Media & Primary Info */}
                                        <div className="lg:col-span-1 space-y-6">
                                            <div>
                                                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 ml-1">Cover Image</label>
                                                <div className="space-y-3">
                                                    <div className="group/upload relative aspect-[3/4] border-2 border-dashed border-zinc-800 hover:border-primary/50 bg-zinc-900/30 rounded-2xl overflow-hidden transition-all duration-300">
                                                        {coverFile || mangaForm.cover ? (
                                                            <div className="absolute inset-0">
                                                                <img 
                                                                    src={coverFile ? URL.createObjectURL(coverFile) : getImageUrl(mangaForm.cover)} 
                                                                    className="w-full h-full object-cover" 
                                                                    alt="Cover" 
                                                                />
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <p className="text-white text-xs font-bold">Change Image</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                                                <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500">
                                                                    <Image className="w-6 h-6" />
                                                                </div>
                                                                <p className="text-[10px] text-zinc-500 font-bold uppercase">Click to upload</p>
                                                            </div>
                                                        )}
                                                        <input
                                                            type="file"
                                                            id="cover-file"
                                                            accept="image/*"
                                                            onChange={e => setCoverFile(e.target.files?.[0] || null)}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        />
                                                    </div>
                                                    <Input
                                                        placeholder="Or Paste Image URL"
                                                        value={mangaForm.cover}
                                                        onChange={e => setMangaForm({ ...mangaForm, cover: e.target.value })}
                                                        className="bg-zinc-900/30 border-zinc-800/50 text-xs"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 ml-1">Background <span className="opacity-50">(Banner)</span></label>
                                                <div className="space-y-3">
                                                    <div className="group/upload relative aspect-video border-2 border-dashed border-zinc-800 hover:border-primary/50 bg-zinc-900/30 rounded-2xl overflow-hidden transition-all duration-300">
                                                        {bgFile || mangaForm.backgroundImage ? (
                                                            <div className="absolute inset-0">
                                                                <img 
                                                                    src={bgFile ? URL.createObjectURL(bgFile) : getImageUrl(mangaForm.backgroundImage)} 
                                                                    className="w-full h-full object-cover" 
                                                                    alt="Background" 
                                                                />
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <p className="text-white text-xs font-bold">Change Image</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500">
                                                                    <Image className="w-5 h-5" />
                                                                </div>
                                                                <p className="text-[9px] text-zinc-500 font-bold uppercase">Wide Banner Image</p>
                                                            </div>
                                                        )}
                                                        <input
                                                            type="file"
                                                            id="bg-file"
                                                            accept="image/*"
                                                            onChange={e => setBgFile(e.target.files?.[0] || null)}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        />
                                                    </div>
                                                    <Input
                                                        placeholder="Or Paste Banner URL"
                                                        value={mangaForm.backgroundImage}
                                                        onChange={e => setMangaForm({ ...mangaForm, backgroundImage: e.target.value })}
                                                        className="bg-zinc-900/30 border-zinc-800/50 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Columns: All Other Info */}
                                        <div className="lg:col-span-2 space-y-8">
                                            {/* Basic Info Row */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Title</label>
                                                    <Input value={mangaForm.title} onChange={e => setMangaForm({ ...mangaForm, title: e.target.value })} required className="bg-zinc-900/30 border-zinc-800/50 text-base py-6" />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 ml-1">Description</label>
                                                    <textarea
                                                        className="w-full px-4 py-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 focus:bg-zinc-900/50 transition-all min-h-[120px] text-sm resize-none custom-scrollbar"
                                                        value={mangaForm.description}
                                                        onChange={e => setMangaForm({ ...mangaForm, description: e.target.value })}
                                                        placeholder="Write a compelling story summary..."
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Author / Artist</label>
                                                    <Input value={mangaForm.author} onChange={e => setMangaForm({ ...mangaForm, author: e.target.value })} required className="bg-zinc-900/30 border-zinc-800/50" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Release Year</label>
                                                    <Input value={mangaForm.releaseYear} onChange={e => setMangaForm({ ...mangaForm, releaseYear: e.target.value })} className="bg-zinc-900/30 border-zinc-800/50" />
                                                </div>
                                            </div>

                                            {/* Status & Type Row */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-zinc-900/20 rounded-2xl border border-white/5">
                                                <div>
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 ml-1">Series Status</label>
                                                    <div className="flex gap-2">
                                                        {['Ongoing', 'Completed', 'Hiatus'].map(status => (
                                                            <button
                                                                key={status}
                                                                type="button"
                                                                onClick={() => setMangaForm({ ...mangaForm, status: status as any })}
                                                                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all border ${mangaForm.status === status 
                                                                    ? 'bg-primary/20 border-primary/50 text-primary' 
                                                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                                                            >
                                                                {status}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 ml-1">Content Type</label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {['Manhwa', 'Manga', 'Manhua'].map(type => (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() => setMangaForm({ ...mangaForm, type: type as any })}
                                                                className={`py-2.5 rounded-xl text-[10px] font-black transition-all border ${mangaForm.type === type 
                                                                    ? 'bg-primary/20 border-primary/50 text-primary' 
                                                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                                                            >
                                                                {type}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stats & Integrations Row */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Initial Views</label>
                                                    <Input type="number" value={mangaForm.views} onChange={e => setMangaForm({ ...mangaForm, views: parseInt(e.target.value) || 0 })} className="bg-zinc-900/30 border-zinc-800/50" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Custom Updated Date</label>
                                                    <Input type="datetime-local" value={mangaForm.updatedAt} onChange={e => setMangaForm({ ...mangaForm, updatedAt: e.target.value })} className="bg-zinc-900/30 border-zinc-800/50" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Discord Role ID</label>
                                                    <Input placeholder="123456789..." value={mangaForm.discordRoleId} onChange={e => setMangaForm({ ...mangaForm, discordRoleId: e.target.value })} className="bg-zinc-900/30 border-zinc-800/50" />
                                                </div>
                                            </div>

                                            {/* Genres Section */}
                                            <div>
                                                <div className="flex items-center justify-between mb-4 ml-1">
                                                    <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest">Genres Selection</label>
                                                    <span className="text-[10px] font-bold text-primary">{mangaForm.genres.length} Selected</span>
                                                </div>
                                                <div className="p-4 bg-zinc-950/40 rounded-2xl border border-white/5">
                                                    <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {COMMON_GENRES.map(g => (
                                                            <button
                                                                key={g}
                                                                type="button"
                                                                onClick={() => handleGenreToggle(g)}
                                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all duration-300 ${mangaForm.genres.includes(g)
                                                                    ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] scale-105'
                                                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                                                                    }`}
                                                            >
                                                                {g}
                                                            </button>
                                                        ))}
                                                        {mangaForm.genres.filter(g => !COMMON_GENRES.includes(g)).map(g => (
                                                            <button
                                                                key={g}
                                                                type="button"
                                                                onClick={() => handleGenreToggle(g)}
                                                                className="px-3 py-1.5 rounded-xl text-[10px] font-black border bg-primary text-white border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] scale-105"
                                                            >
                                                                {g}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                                                        <input
                                                            placeholder="Add custom genre..."
                                                            value={customGenre}
                                                            onChange={e => setCustomGenre(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    addCustomGenre();
                                                                }
                                                            }}
                                                            className="flex-1 bg-transparent border-0 text-sm focus:outline-none focus:ring-0 text-white placeholder:text-zinc-600"
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={addCustomGenre} 
                                                            className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-6">
                                        {isEditingManga && (
                                            <button 
                                                type="button" 
                                                onClick={() => { setIsEditingManga(false); setMangaForm({ title: '', cover: '', backgroundImage: '', description: '', author: '', status: 'Ongoing', type: 'Manhwa', genres: [], discordRoleId: '', releaseYear: '2024', views: 0, updatedAt: '' }); setCoverFile(null); setBgFile(null); }} 
                                                className="flex-1 py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-black text-sm hover:bg-zinc-800 transition-all uppercase tracking-widest"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button 
                                            type="submit" 
                                            className={`flex-[2] py-3.5 rounded-xl bg-primary text-white font-black text-sm hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] transition-all uppercase tracking-widest flex items-center justify-center gap-2 group/submit`}
                                        >
                                            {isEditingManga ? (
                                                <>Save Changes <CheckCircle className="w-4 h-4 group-hover/submit:scale-110 transition-transform" /></>
                                            ) : (
                                                <>Publish Manga <Plus className="w-5 h-5 group-hover/submit:rotate-90 transition-transform" /></>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </Card>

                        {/* Existing Manga Section */}
                        <div className="space-y-8">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/40 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
                                <h3 className="font-black text-xl tracking-tight flex items-center gap-2 text-white">
                                    Existing Manga 
                                    <span className="text-primary text-sm bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">{mangas.length}</span>
                                </h3>
                                <div className="relative w-full sm:w-72 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Quick search..."
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-zinc-800 text-sm focus:outline-none focus:border-primary/50 text-white transition-all placeholder:text-zinc-700"
                                        value={mangaSearch}
                                        onChange={e => setMangaSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 max-h-[640px] overflow-y-auto pr-2 custom-scrollbar pb-10">
                                {mangas.filter(m => m.title.toLowerCase().includes(mangaSearch.toLowerCase())).map(m => (
                                    <div key={m.id} className="group relative flex gap-5 p-4 bg-zinc-900/20 rounded-2xl border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-500 overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                                        
                                        <div className="relative w-20 h-28 flex-shrink-0 overflow-hidden rounded-xl shadow-2xl shadow-black/50">
                                            <img src={getImageUrl(m.cover)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                        </div>

                                        <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                            <div className="space-y-1">
                                                <h4 className="font-black text-base text-white group-hover:text-primary transition-colors truncate tracking-tight">{m.title}</h4>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                                                    <span className="text-zinc-400">{m.author}</span>
                                                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                    <span className={`px-2 py-0.5 rounded ${m.status === 'Ongoing' ? 'text-green-500 bg-green-500/10' : 'text-zinc-500 bg-zinc-500/10'}`}>
                                                        {m.status}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 mt-auto">
                                                <Badge color="bg-primary/10 text-primary border-primary/20 text-[9px] uppercase font-black tracking-widest">{m.type}</Badge>
                                                <Badge color="bg-black/40 text-yellow-500 border-white/5 text-[9px] font-black flex items-center gap-1">
                                                    <span className="text-xs">★</span> {m.rating || '0'}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 justify-center relative z-10">
                                            {currentUser?.role === 'admin' && (
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <button onClick={() => handleEditManga(m)} className="p-2.5 bg-zinc-900 hover:bg-blue-500 text-blue-400 hover:text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-blue-500/30 group/edit" title="Edit Manga">
                                                        <Edit2 className="w-3.5 h-3.5 group-hover/edit:scale-110 transition-transform" />
                                                    </button>
                                                    <button onClick={() => handleDeleteManga(m.id)} className="p-2.5 bg-zinc-900 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-red-500/30 group/delete" title="Delete Manga">
                                                        <Trash2 className="w-3.5 h-3.5 group-hover/delete:scale-110 transition-transform" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* SCRAPER TAB */}
                {activeTab === 'scraper' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <Card className="p-6 lg:col-span-1 bg-black/40 border-zinc-800 h-fit">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                                    <Search className="w-5 h-5 text-primary" />
                                    {isScraperBulkMode ? 'Bulk Chapter Scraper' : 'Auto Chapter Scraper'}
                                </h2>
                                <p className="text-xs text-zinc-500 mb-6 italic leading-relaxed">
                                    {isScraperBulkMode
                                        ? 'Paste multiple chapter URLs (one per line) to scrape them all at once.'
                                        : 'Enter a chapter URL from another site to automatically extract and download images.'}
                                </p>

                                <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5 mb-6 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => setIsScraperBulkMode(false)}
                                        className={`flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${!isScraperBulkMode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        Single URL
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setIsScraperBulkMode(true); setScraperRangeMode(true); }}
                                        className={`flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${isScraperBulkMode && scraperRangeMode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        Range
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setIsScraperBulkMode(true); setScraperRangeMode(false); }}
                                        className={`flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${isScraperBulkMode && !scraperRangeMode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        List
                                    </button>
                                </div>

                                <form onSubmit={handleScraper} className="space-y-6">
                                    {isScraperBulkMode ? (
                                        scraperRangeMode ? (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-zinc-400 mb-2 text-xs">URL Template (use {'{ch}'} for number)</label>
                                                    <Input
                                                        placeholder="https://site.com/manga/ch-{ch}"
                                                        value={scraperUrlTemplate}
                                                        onChange={e => setScraperUrlTemplate(e.target.value)}
                                                        required
                                                        className="bg-zinc-900/50 border-zinc-800 text-xs"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Input label="From Chapter" type="number" value={scraperRangeStart} onChange={e => setScraperRangeStart(e.target.value)} required />
                                                    <Input label="To Chapter" type="number" value={scraperRangeEnd} onChange={e => setScraperRangeEnd(e.target.value)} required />
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-sm font-medium text-zinc-400 mb-2">Bulk Chapter URLs</label>
                                                <textarea
                                                    placeholder="https://site.com/ch-1&#10;https://site.com/ch-2&#10;https://site.com/ch-3"
                                                    className="w-full px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[150px] text-xs font-mono"
                                                    value={scraperBulkUrls}
                                                    onChange={e => setScraperBulkUrls(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        )
                                    ) : (
                                        <Input
                                            label="Chapter URL"
                                            placeholder="https://example.com/manga/chapter-1"
                                            value={scraperUrl}
                                            onChange={e => setScraperUrl(e.target.value)}
                                            required
                                            className="bg-zinc-900/50 border-zinc-800"
                                        />
                                    )}

                                    <div className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/50">
                                        <input
                                            type="checkbox"
                                            id="auto-publish"
                                            checked={autoPublish}
                                            onChange={e => setAutoPublish(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-800 text-primary focus:ring-primary bg-zinc-900"
                                        />
                                        <label htmlFor="auto-publish" className="text-sm font-bold text-zinc-300 cursor-pointer">
                                            Auto Publish as Chapter
                                        </label>
                                    </div>

                                    {autoPublish && (
                                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                            <div>
                                                <label className="block text-sm font-medium text-zinc-400 mb-2">Target Manga</label>
                                                <div className="relative">
                                                    <div
                                                        onClick={() => setIsScraperMangaDropdownOpen(!isScraperMangaDropdownOpen)}
                                                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white cursor-pointer flex justify-between items-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    >
                                                        <span className={scraperMangaId ? "text-white" : "text-zinc-500"}>
                                                            {scraperMangaId ? mangas.find(m => m.id === scraperMangaId)?.title : '-- Choose Manga --'}
                                                        </span>
                                                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                                                    </div>
                                                    {isScraperMangaDropdownOpen && (
                                                        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl max-h-[250px] flex flex-col overflow-hidden">
                                                            <div className="p-2 border-b border-zinc-800 bg-zinc-800/50">
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    className="w-full bg-black/40 border border-zinc-700 rounded py-2 px-3 text-sm text-white focus:outline-none focus:border-primary"
                                                                    placeholder="Search..."
                                                                    value={scraperMangaDropdownSearch}
                                                                    onChange={e => setScraperMangaDropdownSearch(e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="overflow-y-auto p-1 custom-scrollbar">
                                                                {mangas.filter(m => m.title.toLowerCase().includes(scraperMangaDropdownSearch.toLowerCase())).map(m => (
                                                                    <div
                                                                        key={m.id}
                                                                        className={`px-3 py-2 text-sm cursor-pointer rounded transition-colors ${scraperMangaId === m.id ? 'bg-primary/20 text-primary' : 'text-zinc-300 hover:bg-zinc-800'}`}
                                                                        onClick={() => {
                                                                            setScraperMangaId(m.id);
                                                                            setIsScraperMangaDropdownOpen(false);
                                                                        }}
                                                                    >
                                                                        {m.title}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="space-y-1">
                                                    <Input
                                                        label={isScraperBulkMode ? "Starting Chapter #" : "Chapter #"}
                                                        placeholder="1"
                                                        type="number"
                                                        step="0.1"
                                                        value={scraperChapterNumber}
                                                        onChange={e => setScraperChapterNumber(e.target.value)}
                                                        required={autoPublish}
                                                    />
                                                    {isScraperBulkMode && <p className="text-[9px] text-primary/70 font-bold italic">* Numbers will increment automatically</p>}
                                                </div>
                                            </div>

                                            <div className="border-t border-zinc-800/50 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <Input 
                                                    label="Source Name" 
                                                    placeholder="e.g. Asura Scans" 
                                                    value={scraperSourceName} 
                                                    onChange={e => setScraperSourceName(e.target.value)} 
                                                    className="text-xs"
                                                />
                                                <div className="space-y-1">
                                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Source Color</label>
                                                    <div className="flex gap-2 items-center">
                                                        <input 
                                                            type="color" 
                                                            value={scraperSourceColor} 
                                                            onChange={e => setScraperSourceColor(e.target.value)} 
                                                            className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer"
                                                        />
                                                        <Input 
                                                            placeholder="#e11d48" 
                                                            value={scraperSourceColor} 
                                                            onChange={e => setScraperSourceColor(e.target.value)} 
                                                            className="flex-1 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <Button type="submit" className="w-full py-4 bg-primary hover:bg-primaryDark text-black font-black" disabled={isScraping}>
                                        {isScraping ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                {autoPublish ? 'Scraping & Publishing...' : 'Scraping...'}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-2">
                                                <Search className="w-5 h-5" />
                                                {autoPublish ? 'Start Auto Scraper' : 'Preview Images'}
                                            </div>
                                        )}
                                    </Button>
                                </form>
                            </Card>

                            <div className="lg:col-span-2 space-y-6">
                                {isScraping && (
                                    <div className="flex flex-col items-center justify-center bg-zinc-900/40 rounded-2xl border border-primary/20 p-8 shadow-2xl shadow-primary/5 animate-in zoom-in-95 duration-300">
                                        <div className="relative mb-8">
                                            <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="text-xl font-black text-primary">{scraperProgress}%</div>
                                            </div>
                                        </div>

                                        <div className="w-full max-w-md space-y-4">
                                            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                                                <div
                                                    className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"
                                                    style={{ width: `${scraperProgress}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-black text-zinc-500">
                                                <span>Session Progress</span>
                                                <span className="text-primary">{scraperProgress}% Completed</span>
                                            </div>
                                        </div>

                                        <p className="mt-8 text-zinc-300 font-bold text-center text-sm">
                                            {isScraperBulkMode
                                                ? `Processing bulk chapters...`
                                                : 'Analyzing page content and extracting images...'}
                                        </p>
                                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-2">Background process active - you can safely close this tab</p>
                                    </div>
                                )}

                                {!scraperResult && (
                                    <Card className="p-6 bg-zinc-950/20 border-white/5">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-primary" />
                                                Recent & Active Jobs
                                            </h3>
                                            <div className="text-[10px] font-black uppercase text-zinc-500 tracking-widest bg-zinc-800 px-2 py-1 rounded">
                                                Auto-refreshing
                                            </div>
                                        </div>

                                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                            {scraperJobs.length === 0 ? (
                                                <div className="py-12 text-center border border-dashed border-white/5 rounded-xl">
                                                    <p className="text-zinc-500 text-sm italic">No recent jobs found.</p>
                                                </div>
                                            ) : (
                                                scraperJobs.map((job) => (
                                                    <div key={job.id} className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 hover:border-zinc-700 transition-all group">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-2 h-2 rounded-full ${
                                                                    job.status === 'processing' ? 'bg-blue-500 animate-pulse' : 
                                                                    job.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
                                                                }`} />
                                                                <span className="text-xs font-black uppercase tracking-wider text-zinc-300">
                                                                    {job.status}
                                                                </span>
                                                                <span className="text-[10px] text-zinc-600 font-bold">
                                                                    {new Date(job.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-zinc-500 font-mono bg-black/40 px-2 py-1 rounded">
                                                                ID: {job.id.slice(-8)}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full transition-all duration-1000 ${
                                                                        job.status === 'completed' ? 'bg-green-500' : 
                                                                        job.status === 'failed' ? 'bg-red-500' : 'bg-primary'
                                                                    }`}
                                                                    style={{ width: `${job.progress}%` }}
                                                                />
                                                            </div>
                                                            <div className="flex justify-between text-[9px] font-bold uppercase tracking-tighter">
                                                                <span className="text-zinc-600">Progress: {job.progress}%</span>
                                                                {job.error && <span className="text-red-500 line-clamp-1 max-w-[200px]">{job.error}</span>}
                                                                {job.status === 'completed' && (
                                                                    <button 
                                                                        onClick={() => setScraperResult(job.results)}
                                                                        className="text-primary hover:underline"
                                                                    >
                                                                        View Results
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </Card>
                                )}

                                {scraperResult ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xl font-bold flex items-center gap-2">
                                                {scraperResult.success
                                                    ? <CheckCircle className="text-green-500 w-6 h-6" />
                                                    : <Badge color="bg-primary/20 text-primary">{(scraperResult as any).results?.length || scraperResult.images?.length || 0}</Badge>}
                                                {scraperResult.success ? (isScraperBulkMode ? 'Bulk Publishing Done' : 'Publishing Completed') : 'Extraction Results'}
                                            </h3>
                                            <Button variant="secondary" size="sm" onClick={() => setScraperResult(null)}>Clear</Button>
                                        </div>

                                        {/* Bulk Results Table */}
                                        {isScraperBulkMode && (scraperResult as any).results && (
                                            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
                                                <div className="p-4 border-b border-zinc-800 bg-zinc-800/20 flex justify-between items-center">
                                                    <h4 className="font-bold text-sm">Bulk Results</h4>
                                                    <div className="flex gap-3 text-xs">
                                                        <span className="text-green-500 font-bold">{(scraperResult as any).results.filter((r: any) => !r.error).length} ✓ Succeeded</span>
                                                        <span className="text-red-500 font-bold">{(scraperResult as any).results.filter((r: any) => r.error).length} ✗ Failed</span>
                                                    </div>
                                                </div>
                                                <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                                                    {(scraperResult as any).results.map((r: any, idx: number) => (
                                                        <div key={idx} className={`border-b border-zinc-800/50 last:border-0 ${r.error ? 'bg-red-500/5' : 'bg-green-500/5'}`}>
                                                            <div
                                                                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                                                onClick={() => {
                                                                    if (r.images) {
                                                                        setExpandedBulkIndices(prev =>
                                                                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                                                        );
                                                                    }
                                                                }}
                                                            >
                                                                <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${r.error ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                                                    {r.error ? <span className="text-[10px] font-black">✗</span> : <span className="text-[10px] font-black">✓</span>}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-center gap-2">
                                                                        <p className="text-xs text-zinc-400 truncate flex-1" title={r.url}>{r.url}</p>
                                                                        {r.images && (
                                                                            <span className="text-[10px] text-zinc-600 font-bold bg-black/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                                {expandedBulkIndices.includes(idx) ? <ChevronDown className="w-3 h-3 rotate-180 transition-transform" /> : <ChevronDown className="w-3 h-3 transition-transform" />}
                                                                                {expandedBulkIndices.includes(idx) ? 'Hide Images' : 'Show Images'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {r.error
                                                                        ? <p className="text-[11px] text-red-400 mt-1">{r.error}</p>
                                                                        : <p className="text-[11px] text-green-400 mt-1">{r.imagesCount || r.images?.length || 0} pages {r.success ? 'published' : 'found'}</p>}
                                                                </div>
                                                            </div>

                                                            {/* Expanded Images Grid */}
                                                            {expandedBulkIndices.includes(idx) && r.images && (
                                                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                                                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-2 bg-black/40 rounded-lg border border-white/5">
                                                                        {r.images.map((img: string, i: number) => (
                                                                            <div key={i} className="aspect-[3/4] rounded-md overflow-hidden border border-white/5 bg-zinc-900/50">
                                                                                <img
                                                                                    src={img.startsWith('/api/') ? img : img}
                                                                                    className="w-full h-full object-cover"
                                                                                    alt=""
                                                                                    loading="lazy"
                                                                                />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                {scraperResult.success && (
                                                    <div className="p-4 bg-green-500/5 border-t border-green-500/10 flex justify-between items-center">
                                                        <p className="text-sm text-green-400 font-bold">{(scraperResult as any).imagesCount} total images published</p>
                                                        <Button onClick={() => setActiveTab('chapters')} className="bg-green-500 hover:bg-green-600 text-white text-xs">View Chapters</Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Single Result - Success */}
                                        {!isScraperBulkMode && scraperResult.success && (
                                            <Card className="p-12 text-center bg-green-500/5 border-green-500/20">
                                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                                    <CheckCircle className="w-10 h-10 text-green-500" />
                                                </div>
                                                <h4 className="text-2xl font-black text-white mb-2">Successfully Published!</h4>
                                                <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                                                    Downloaded {(scraperResult as any).imagesCount} images and published the chapter.
                                                </p>
                                                <Button onClick={() => setActiveTab('chapters')} className="bg-green-500 hover:bg-green-600 text-white">
                                                    View in Chapters List
                                                </Button>
                                            </Card>
                                        )}

                                        {/* Single Result - Image Preview */}
                                        {!isScraperBulkMode && !scraperResult.success && scraperResult.images && scraperResult.images.length > 0 && (
                                            <div className="space-y-3">
                                                <p className="text-xs text-zinc-500 font-bold">{scraperResult.images.length} images found. Enable "Auto Publish" to publish them.</p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                                    {scraperResult.images.map((img, idx) => (
                                                        <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/5 bg-zinc-900 group">
                                                            <img src={img} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" loading="lazy" />
                                                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                                                                #{idx + 1}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full min-h-[450px] flex flex-col items-center justify-center bg-white/[0.02] rounded-3xl border-2 border-dashed border-white/5 opacity-40 group hover:opacity-60 transition-opacity duration-500">
                                        <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mb-8 border border-white/5 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                            <Search className="w-10 h-10 text-zinc-600 group-hover:text-primary transition-colors" />
                                        </div>
                                        <p className="text-zinc-400 font-black uppercase tracking-[0.2em] text-xs">Ready to Scrape</p>
                                        <p className="text-zinc-600 text-[10px] mt-2 font-bold uppercase tracking-widest">Paste a link to start extraction</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* CHAPTERS TAB */}
                {activeTab === 'chapters' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <Card className="p-6 lg:col-span-2 bg-black/40 border-zinc-800">
                            <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
                                <FileText className="w-5 h-5 text-primary" />
                                {isEditingChapter ? 'Edit Chapter' : 'Upload Chapter'}
                            </h2>
                            <form onSubmit={handleChapterSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Select Manga</label>
                                    <div className="relative">
                                        <div
                                            onClick={() => setIsMangaDropdownOpen(!isMangaDropdownOpen)}
                                            className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white cursor-pointer flex justify-between items-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        >
                                            <span className={chapterMangaId ? "text-white" : "text-zinc-500"}>
                                                {chapterMangaId ? mangas.find(m => m.id === chapterMangaId)?.title : '-- Choose Manga --'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-zinc-500" />
                                        </div>
                                        {isMangaDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl max-h-[300px] flex flex-col overflow-hidden">
                                                <div className="p-2 border-b border-zinc-800 bg-zinc-800/50">
                                                    <div className="relative">
                                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            className="w-full bg-black/40 border border-zinc-700 rounded py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                                            placeholder="Search manga by title..."
                                                            value={mangaDropdownSearch}
                                                            onChange={e => setMangaDropdownSearch(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto p-1 custom-scrollbar">
                                                    <div
                                                        className="px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800/80 hover:text-white cursor-pointer rounded transition-colors"
                                                        onClick={() => {
                                                            setChapterMangaId('');
                                                            setIsMangaDropdownOpen(false);
                                                        }}
                                                    >
                                                        -- Choose Manga --
                                                    </div>
                                                    {mangas.filter(m => m.title.toLowerCase().includes(mangaDropdownSearch.toLowerCase())).map(m => (
                                                        <div
                                                            key={m.id}
                                                            className={`px-3 py-2 text-sm cursor-pointer rounded transition-colors ${chapterMangaId === m.id ? 'bg-primary/20 text-primary font-medium' : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'}`}
                                                            onClick={() => {
                                                                setChapterMangaId(m.id);
                                                                setIsMangaDropdownOpen(false);
                                                                setMangaDropdownSearch('');
                                                            }}
                                                        >
                                                            {m.title}
                                                        </div>
                                                    ))}
                                                    {mangas.filter(m => m.title.toLowerCase().includes(mangaDropdownSearch.toLowerCase())).length === 0 && (
                                                        <div className="px-3 py-4 text-center text-sm text-zinc-500">
                                                            No manga found
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="block text-sm font-medium text-zinc-400">Upload Mode</label>
                                            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsBulkMode(false)}
                                                    className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${!isBulkMode ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                >
                                                    Single Chapter
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsBulkMode(true)}
                                                    className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${isBulkMode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                >
                                                    Bulk Upload (ZIPs)
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {!isBulkMode ? (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <Input label="Chapter Number" placeholder="e.g. 15.5" type="number" step="0.1" value={chapterNumber} onChange={e => setChapterNumber(e.target.value)} required className="bg-zinc-900/50 border-zinc-800" />
                                                <Input label="Chapter Title (Optional)" placeholder="e.g. The Beginning" value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} className="bg-zinc-900/50 border-zinc-800" />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <Input label="Price (Coins)" type="number" value={chapterPrice} onChange={e => setChapterPrice(e.target.value)} className="bg-zinc-900/50 border-zinc-800" />
                                                <Input label="Free Date (Optional)" type="datetime-local" value={chapterFreeDate} onChange={e => setChapterFreeDate(e.target.value)} className="bg-zinc-900/50 border-zinc-800" />
                                                <Input label="Release Date (Published At)" type="datetime-local" value={chapterReleaseDate} onChange={e => setChapterReleaseDate(e.target.value)} className="bg-zinc-900/50 border-zinc-800" />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <Input label="Source Name" placeholder="e.g. Asura Scans" value={chapterSourceName} onChange={e => setChapterSourceName(e.target.value)} className="bg-zinc-900/50 border-zinc-800" />
                                                <div className="space-y-1">
                                                    <label className="block text-sm font-medium text-zinc-400 mb-1">Source Color</label>
                                                    <div className="flex gap-2 items-center">
                                                        <input 
                                                            type="color" 
                                                            value={chapterSourceColor} 
                                                            onChange={e => setChapterSourceColor(e.target.value)} 
                                                            className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer"
                                                        />
                                                        <Input 
                                                            placeholder="#e11d48" 
                                                            value={chapterSourceColor} 
                                                            onChange={e => setChapterSourceColor(e.target.value)} 
                                                            className="flex-1 bg-zinc-900/50 border-zinc-800"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="block text-sm font-medium text-zinc-400">Chapter Pages</label>
                                                    <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                                                        <button
                                                            type="button"
                                                            onClick={() => setChapterUploadMethod('file')}
                                                            className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${chapterUploadMethod === 'file' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                        >
                                                            Files
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setChapterUploadMethod('url')}
                                                            className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${chapterUploadMethod === 'url' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                        >
                                                            Links
                                                        </button>
                                                    </div>
                                                </div>

                                                {chapterUploadMethod === 'file' ? (
                                                    <div className="space-y-4">
                                                        <div
                                                            onClick={() => document.getElementById('chapter-files')?.click()}
                                                            onDragOver={handleDragOver}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={handleDrop}
                                                            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all group ${isDragging ? 'border-primary bg-primary/5' : 'border-zinc-800 bg-zinc-900/30 hover:border-primary/50'}`}
                                                        >
                                                            <input type="file" id="chapter-files" multiple accept="image/*,.zip" onChange={handleFileSelect} className="hidden" />
                                                            <div className="flex flex-col items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${isDragging ? 'bg-primary/20 border-primary' : 'bg-zinc-900 border-zinc-800 group-hover:bg-primary/10 group-hover:border-primary/30'}`}>
                                                                    {isUploading ? (
                                                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                                    ) : (
                                                                        <Image className={`w-6 h-6 transition-all ${isDragging ? 'text-primary' : 'text-zinc-500 group-hover:text-primary'}`} />
                                                                    )}
                                                                </div>
                                                                <p className={`text-sm transition-all ${isDragging ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                                                                    {isUploading ? 'Extracting ZIP...' : 'Drag images or select a ZIP file'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Unified Pages Preview Grid */}
                                                        {chapterPages.length > 0 && (
                                                            <div className="bg-zinc-950/40 rounded-2xl border border-white/5 p-6 animate-in fade-in slide-in-from-top-4 duration-700 mt-6 backdrop-blur-xl relative overflow-hidden group">
                                                                {/* Background glow */}
                                                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/10 transition-colors" />
                                                                
                                                                <div className="flex items-center justify-between mb-6 relative z-10">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                                                            <LayoutDashboard className="w-5 h-5 text-primary" />
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-sm font-black text-white uppercase tracking-tight">Sequence Organizer</h4>
                                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{chapterPages.length} Pages Organized</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 relative z-10">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setChapterPages([])}
                                                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-500/20 transition-all active:scale-95"
                                                                        >
                                                                            Clear All
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 relative z-10">
                                                                    {chapterPages.map((page, idx) => (
                                                                        <div key={page.id} className="relative group aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-zinc-900 shadow-2xl transition-all duration-300 hover:border-primary/50 hover:shadow-primary/10">
                                                                            <img
                                                                                src={page.type === 'file' ? page.previewUrl : page.content as string}
                                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                                alt=""
                                                                            />
                                                                            
                                                                            {/* Page Number Badge (Always Visible) */}
                                                                            <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 z-20">
                                                                                <p className="text-[10px] font-black text-white">#{idx + 1}</p>
                                                                            </div>

                                                                            {/* Overlay Controls */}
                                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 p-4 flex flex-col justify-end gap-3 translate-y-4 group-hover:translate-y-0">
                                                                                <div className="flex justify-center gap-1.5">
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={idx === 0}
                                                                                        onClick={() => movePage(idx, 'up')}
                                                                                        className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-primary hover:text-white disabled:opacity-20 rounded-xl text-zinc-300 transition-all active:scale-90"
                                                                                        title="Move Up"
                                                                                    >
                                                                                        <ChevronDown className="w-5 h-5 rotate-[180deg]" />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={idx === chapterPages.length - 1}
                                                                                        onClick={() => movePage(idx, 'down')}
                                                                                        className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-primary hover:text-white disabled:opacity-20 rounded-xl text-zinc-300 transition-all active:scale-90"
                                                                                        title="Move Down"
                                                                                    >
                                                                                        <ChevronDown className="w-5 h-5" />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => removePage(idx)}
                                                                                        className="w-9 h-9 flex items-center justify-center bg-red-500/20 hover:bg-red-500 text-white rounded-xl transition-all active:scale-90"
                                                                                        title="Delete Page"
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            {page.type === 'file' && (
                                                                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm px-2 py-1 text-[8px] text-white truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    {(page.content as File).name}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <textarea
                                                        placeholder="Paste one image URL per line"
                                                        className="w-full px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[150px] text-sm"
                                                        value={chapterURLs}
                                                        onChange={e => setChapterURLs(e.target.value)}
                                                    />
                                                )}
                                            </div>

                                            <div className="flex gap-4 pt-8">
                                                {isEditingChapter && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => { setIsEditingChapter(false); setSelectedChapter(null); setChapterTitle(''); setChapterNumber(''); setChapterFiles(null); setChapterURLs(''); setChapterPrice('0'); setChapterFreeDate(''); setChapterPages([]); }} 
                                                        className="px-8 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-black text-xs hover:bg-zinc-800 transition-all uppercase tracking-widest active:scale-95"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                                <button 
                                                    type="submit" 
                                                    disabled={isUploading}
                                                    className="flex-1 py-4 rounded-2xl bg-primary text-white font-black text-sm hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] transition-all uppercase tracking-widest flex items-center justify-center gap-2 group/btn active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isUploading ? (
                                                        <>Processing <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></>
                                                    ) : (
                                                        <>
                                                            {isEditingChapter ? 'Update Chapter' : 'Publish Chapter'}
                                                            <CheckCircle className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-6 animate-in fade-in duration-500">
                                            <div
                                                onClick={() => document.getElementById('bulk-files')?.click()}
                                                className="border-2 border-dashed border-zinc-800 hover:border-primary/50 bg-black/30 rounded-xl p-10 text-center cursor-pointer transition-all group"
                                            >
                                                <input type="file" id="bulk-files" multiple accept=".zip" onChange={handleBulkFileSelect} className="hidden" />
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all">
                                                        <Plus className="w-6 h-6 text-zinc-500 group-hover:text-primary" />
                                                    </div>
                                                    <p className="text-zinc-500 text-sm">Select multiple ZIP files (Chapter 1, Chapter 2...)</p>
                                                </div>
                                            </div>

                                            {bulkQueue.length > 0 && (
                                                <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
                                                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/20">
                                                        <h3 className="font-bold text-sm">Upload Queue ({bulkQueue.length})</h3>
                                                        <button type="button" onClick={() => setBulkQueue([])} className="text-xs text-zinc-500 hover:text-white uppercase transition-colors">Clear All</button>
                                                    </div>
                                                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="text-[10px] text-zinc-500 uppercase bg-black/20 sticky top-0 z-10">
                                                                <tr>
                                                                    <th className="px-4 py-2">Filename</th>
                                                                    <th className="px-4 py-2 w-24">Chapter</th>
                                                                    <th className="px-4 py-2">Status</th>
                                                                    <th className="px-4 py-2 w-10"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-zinc-800/50">
                                                                {bulkQueue.map((item) => (
                                                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                                        <td className="px-4 py-3">
                                                                            <div className="truncate max-w-[200px] text-zinc-300" title={item.file.name}>{item.file.name}</div>
                                                                            {item.error && <p className="text-[10px] text-red-500 mt-1">{item.error}</p>}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <input
                                                                                type="text"
                                                                                className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
                                                                                value={item.chapterNumber}
                                                                                onChange={(e) => updateBulkItem(item.id, { chapterNumber: e.target.value })}
                                                                                disabled={isProcessingBulk}
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <div className="flex items-center gap-3">
                                                                                <span className={`text-[10px] font-bold uppercase ${item.status === 'completed' ? 'text-green-500' :
                                                                                    item.status === 'error' ? 'text-red-500' :
                                                                                        item.status === 'pending' ? 'text-zinc-500' : 'text-primary'
                                                                                    }`}>
                                                                                    {item.status}
                                                                                </span>
                                                                                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden min-w-[60px]">
                                                                                    <div
                                                                                        className={`h-full transition-all duration-300 ${item.status === 'error' ? 'bg-red-500' : 'bg-primary'}`}
                                                                                        style={{ width: `${item.progress}%` }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeBulkItem(item.id)}
                                                                                className="text-zinc-600 hover:text-red-500 transition-colors"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="p-6 bg-zinc-800/10">
                                                        <Button
                                                            type="button"
                                                            onClick={processBulkQueue}
                                                            className="w-full bg-primary hover:bg-primaryDark text-black font-black py-4 rounded-xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
                                                            disabled={isProcessingBulk || bulkQueue.length === 0 || bulkQueue.every(i => i.status === 'completed')}
                                                        >
                                                            {isProcessingBulk ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                                    Processing Bulk Upload...
                                                                </div>
                                                            ) : 'START BULK UPLOAD'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </form>
                        </Card>

                        <div className="space-y-6 lg:col-span-1">

                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-xl">Recent Chapters</h3>
                                <div className="relative w-40">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] focus:outline-none focus:border-primary text-white"
                                        value={chapterSearch}
                                        onChange={e => setChapterSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                {isLoadingChapters ? (
                                    <div className="py-20 text-center bg-zinc-900 rounded-xl border border-dashed border-zinc-800">
                                        <p className="text-zinc-500 text-sm italic">Select a manga to view its chapters history or delete chapters.</p>
                                    </div>
                                ) : mangaChapters.length === 0 ? (
                                    <div className="py-20 text-center bg-zinc-900 rounded-xl border border-dashed border-zinc-800">
                                        <p className="text-zinc-500 text-sm italic">No chapters found for this manga.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                                        {mangaChapters.filter(c => c.title.toLowerCase().includes(chapterSearch.toLowerCase()) || c.number.toString().includes(chapterSearch)).map(c => (
                                            <div key={c.id} className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 flex items-center justify-between group hover:border-primary/20 transition-all">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-white text-base">Ch. {c.number}</span>
                                                        <span className="text-xs text-zinc-500 truncate max-w-[120px]">{c.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">{(c.pages as string[]).length} pages</span>
                                                        {c.price > 0 && <Badge color="bg-rose-500/10 text-rose-500 border-rose-500/20">{c.price} Coins</Badge>}
                                                    </div>
                                                </div>
                                                {currentUser?.role === 'admin' && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleEditChapter(c)} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteChapter(c.id)} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* SLIDER TAB */}
                {activeTab === 'slider' && currentUser?.role === 'admin' && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold">Hero Slider Management</h2>
                                <p className="text-zinc-500 text-sm">Select mangas to display on the homepage slider (Max 25)</p>
                            </div>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                    <input
                                        type="text"
                                        placeholder="Search manga..."
                                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-primary text-white"
                                        value={sliderSearch}
                                        onChange={e => setSliderSearch(e.target.value)}
                                    />
                                </div>
                                <div className="bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap">
                                    {featuredMangaIds.length} / 25 Selected
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {filteredSliderMangas.map((manga, index) => (
                                <div
                                    key={manga.id}
                                    onClick={() => toggleFeatured(manga.id)}
                                    className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group border-2 transition-all duration-300 ${manga.isFeatured ? 'border-primary shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'border-transparent hover:border-zinc-700'
                                        }`}
                                >
                                    <img
                                        src={getImageUrl(manga.cover)}
                                        alt={manga.title}
                                        className={`w-full h-full object-cover transition-transform duration-500 ${manga.isFeatured ? 'scale-105' : 'group-hover:scale-105'}`}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                                    {manga.isFeatured && (
                                        <div className="absolute top-2 right-2 bg-primary text-white p-1 rounded-full shadow-lg">
                                            <CheckCircle className="w-4 h-4" />
                                        </div>
                                    )}

                                    <div className="absolute bottom-0 left-0 right-0 p-3">
                                        <p className="text-white text-xs font-bold line-clamp-2 leading-tight">
                                            {manga.title}
                                        </p>
                                    </div>

                                    {manga.isFeatured && (
                                        <div className="absolute bottom-2 left-2 text-[10px] font-bold text-white/50">
                                            {featuredMangaIds.indexOf(manga.id) + 1}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TRANSACTIONS TAB */}
                {activeTab === 'transactions' && currentUser?.role === 'admin' && (
                    <Card className="p-6 bg-black/40 border-zinc-800">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-primary" /> Coin Transactions
                                </h2>
                                <p className="text-zinc-500 text-xs mt-1">Monitor all coin purchases and spending across the platform.</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                                {/* Date Range Pickers */}
                                <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
                                    <input
                                        type="date"
                                        value={transactionStartDate}
                                        onChange={e => setTransactionStartDate(e.target.value)}
                                        className="bg-transparent text-[11px] text-zinc-300 px-2 outline-none border-0 font-bold uppercase tracking-tighter"
                                        title="Start Date"
                                    />
                                    <span className="text-zinc-700">-</span>
                                    <input
                                        type="date"
                                        value={transactionEndDate}
                                        onChange={e => setTransactionEndDate(e.target.value)}
                                        className="bg-transparent text-[11px] text-zinc-300 px-2 outline-none border-0 font-bold uppercase tracking-tighter"
                                        title="End Date"
                                    />
                                    {(transactionStartDate || transactionEndDate) && (
                                        <button onClick={() => { setTransactionStartDate(''); setTransactionEndDate(''); }} className="text-red-500 hover:text-red-400 p-1">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                <div className="relative flex-1 lg:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                    <input
                                        placeholder="Search..."
                                        value={transactionSearch}
                                        onChange={e => setTransactionSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-primary text-white transition-all"
                                    />
                                </div>

                                <button
                                    onClick={exportTransactionsToCSV}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border border-white/5 active:scale-95"
                                >
                                    <FileText className="w-3.5 h-3.5" /> Download CSV
                                </button>
                            </div>
                        </div>

                        {isLoadingTransactions ? (
                            <div className="py-24 text-center">
                                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-zinc-500 text-sm italic">Retrieving transaction history...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                                            <th className="pb-4 pr-4">User</th>
                                            <th className="pb-4 pr-4">Amount</th>
                                            <th className="pb-4 pr-4 text-primary">Score</th>
                                            <th className="pb-4 pr-4">Type</th>
                                            <th className="pb-4 pr-4">Description</th>
                                            <th className="pb-4">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {transactions
                                            .filter(t => {
                                                const matchesSearch = t.user?.username?.toLowerCase().includes(transactionSearch.toLowerCase()) ||
                                                    t.user?.email?.toLowerCase().includes(transactionSearch.toLowerCase()) ||
                                                    t.description?.toLowerCase().includes(transactionSearch.toLowerCase());

                                                const tDate = new Date(t.createdAt);
                                                const matchesStart = transactionStartDate ? tDate >= new Date(transactionStartDate) : true;
                                                const matchesEnd = transactionEndDate ? tDate <= new Date(new Date(transactionEndDate).setHours(23, 59, 59, 999)) : true;

                                                return matchesSearch && matchesStart && matchesEnd;
                                            })
                                            .map((t) => (
                                                <tr key={t.id} className="group hover:bg-white/[0.02] transition-colors border-b border-white/[0.02] last:border-0 font-medium">
                                                    <td className="py-4 pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 border border-white/5">
                                                                {t.user?.username?.slice(0, 2).toUpperCase() || '??'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-white group-hover:text-primary transition-colors">{t.user?.username || 'Unknown'}</p>
                                                                <p className="text-[10px] text-zinc-500 truncate max-w-[120px]">{t.user?.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 pr-4">
                                                        <span className={`font-bold flex items-center gap-1 ${t.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {t.amount > 0 ? '+' : ''}{t.amount}
                                                            <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-[8px] text-rose-500 font-bold">C</div>
                                                        </span>
                                                    </td>
                                                    <td className="py-4 pr-4">
                                                        <span className="text-primary font-mono text-xs font-bold">{t.balanceAfter ?? '-'}</span>
                                                    </td>
                                                    <td className="py-4 pr-4">
                                                        <Badge color={t.type === 'PURCHASE' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-zinc-800 border-zinc-700'}>
                                                            {t.type}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-4 pr-4 text-zinc-400 text-xs italic max-w-[200px] truncate" title={t.description}>
                                                        {t.description}
                                                    </td>
                                                    <td className="py-4 text-zinc-500 text-[10px] font-bold uppercase tracking-tight whitespace-nowrap">
                                                        {new Date(t.createdAt).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        {transactions.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-20 text-center text-zinc-500 italic text-sm">
                                                    No transactions found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                )}

                {/* USERS TAB (Admin Only) */}
                {activeTab === 'users' && currentUser?.role === 'admin' && (
                    <div className="space-y-8">
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" /> Manage Users
                            </h2>
                            <form onSubmit={handleUserSearch} className="flex gap-4 mb-8">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                    <Input
                                        placeholder="Search by username or email..."
                                        className="pl-12"
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                    />
                                </div>
                                <Button type="submit" disabled={isSearchingUsers}>
                                    {isSearchingUsers ? 'Searching...' : 'Search Users'}
                                </Button>
                            </form>

                            {/* Search Results */}
                            {searchResults.length > 0 ? (
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg mb-4">Search Results</h3>
                                    <div className="grid gap-4">
                                        {searchResults.map(user => (
                                            <div key={user.id} className="flex flex-col gap-4">
                                                <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                                                    <div className="flex flex-col mb-4 md:mb-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-lg">{user.username}</span>
                                                            <span className={`text-xs px-2 py-0.5 rounded uppercase tracking-wider font-bold ${user.role === 'admin' ? 'bg-red-500/20 text-red-500' : user.role === 'moderator' ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-800 text-zinc-400'}`}>{user.role}</span>
                                                        </div>
                                                        <span className="text-sm text-zinc-500">{user.email}</span>
                                                        <div className="flex items-center gap-1 mt-1 text-rose-500 font-bold text-sm">
                                                            <Coins className="w-4 h-4 fill-current" /> {user.coins} Coins
                                                        </div>
                                                    </div>

                                                    {/* Action Area */}
                                                    <div className="flex items-center gap-2">
                                                        {selectedUserId === user.id ? (
                                                            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                                                                <input
                                                                    type="number"
                                                                    placeholder="Amount"
                                                                    className="w-24 px-3 py-1.5 rounded-lg bg-background border border-zinc-700 text-sm focus:border-primary focus:outline-none"
                                                                    value={coinAmount || ''}
                                                                    onChange={(e) => setCoinAmount(Number(e.target.value))}
                                                                />
                                                                <Button size="sm" onClick={() => handleManageCoins(user.id, coinAmount, 'add')}>Add</Button>
                                                                <Button size="sm" variant="secondary" onClick={() => handleManageCoins(user.id, coinAmount, 'deduct')}>Deduct</Button>
                                                                <Button size="sm" variant="secondary" onClick={() => handleManageCoins(user.id, coinAmount, 'set')}>Set Exact</Button>
                                                                <Button size="sm" variant="secondary" onClick={() => { setSelectedUserId(null); setCoinAmount(0); }}>Cancel</Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Button size="sm" variant="secondary" onClick={() => fetchUserChapters(user.id)} disabled={isFetchingChapters && showChaptersForUserId === user.id}>
                                                                    {isFetchingChapters && showChaptersForUserId === user.id ? 'Loading...' : 'Chapters'}
                                                                </Button>
                                                                <Button size="sm" variant="secondary" onClick={() => setSelectedUserId(user.id)}>
                                                                    Manage Coins
                                                                </Button>
                                                                {user.role === 'moderator' ? (
                                                                    <Button size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-white" onClick={() => handleRoleChange(user.id, 'user')}>
                                                                        Remove Mod
                                                                    </Button>
                                                                ) : user.role === 'user' ? (
                                                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleRoleChange(user.id, 'moderator')}>
                                                                        Make Mod
                                                                    </Button>
                                                                ) : null}
                                                            </>
                                                        )}

                                                    </div>
                                                </div>

                                                {/* User Chapters (Nested) - simplified for the rewrite */}
                                                {showChaptersForUserId === user.id && (
                                                    <Card className="p-4 bg-zinc-900 border-primary/20">
                                                        <div className="flex justify-between mb-4">
                                                            <span className="font-bold">Unlocked Chapters</span>
                                                            <button onClick={() => setShowChaptersForUserId(null)} className="text-zinc-500">Close</button>
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                            {userChapters.map(ch => (
                                                                <div key={ch.id} className="p-2 bg-zinc-800 rounded text-xs flex justify-between">
                                                                    <span className="truncate">{ch.chapter?.manga?.title} Ch.{ch.chapter?.number}</span>
                                                                    <button onClick={() => handleRemoveChapter(user.id, ch.chapterId)} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </Card>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                userSearch && !isSearchingUsers && (
                                    <div className="text-center py-10 text-zinc-500 bg-surface/30 rounded-xl border border-white/5">
                                        No users found matching "{userSearch}"
                                    </div>
                                )
                            )}
                        </Card>
                    </div>
                )}

                {/* PROMO CODES TAB (Admin Only) */}
                {activeTab === 'promo' && currentUser?.role === 'admin' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="p-6 h-fit lg:col-span-1">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-primary"><Coins className="w-5 h-5" /> Add Promo Code</h2>
                            <form onSubmit={handlePromoSubmit} className="space-y-4">
                                <Input label="Code" placeholder="LEGION2024" value={promoForm.code} onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} required />
                                <Input label="Coins Reward" type="number" value={promoForm.coins} onChange={e => setPromoForm({ ...promoForm, coins: e.target.value })} required />
                                <Input label="Max Uses (Optional)" type="number" placeholder="Leave empty for unlimited" value={promoForm.maxUses} onChange={e => setPromoForm({ ...promoForm, maxUses: e.target.value })} />
                                <Input label="Expiry Date (Optional)" type="datetime-local" value={promoForm.expiresAt} onChange={e => setPromoForm({ ...promoForm, expiresAt: e.target.value })} />
                                <Button type="submit" className="w-full">Create Code</Button>
                            </form>
                        </Card>

                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="font-bold text-lg mb-2">Active Promo Codes ({promoCodes.length})</h3>
                            <div className="grid gap-4">
                                {isLoadingPromos ? (
                                    <p className="text-zinc-500 p-8 text-center italic">Loading promo codes...</p>
                                ) : promoCodes.length === 0 ? (
                                    <p className="text-zinc-500 p-8 text-center italic bg-surface/50 rounded-xl border border-dashed border-zinc-800">No active promo codes.</p>
                                ) : (
                                    promoCodes.map(promo => (
                                        <div key={promo.id} className="bg-surface rounded-xl border border-white/5 overflow-hidden group hover:border-primary/30 transition-all duration-300">
                                            <div className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                                                        <Badge color="bg-primary text-white" className="px-2 py-1 text-[10px]">{promo.coins}</Badge>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-lg tracking-wider font-mono">{promo.code}</span>
                                                            <div className="bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-400">
                                                                {promo.maxUses ? `${promo.usedCount}/${promo.maxUses}` : `${promo.usedCount} Uses`}
                                                            </div>
                                                        </div>
                                                        {promo.expiresAt && <PromoCountdown expiryDate={promo.expiresAt} />}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-500">
                                                    <button
                                                        onClick={() => setExpandedPromoId(expandedPromoId === promo.id ? null : promo.id)}
                                                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                                                        title="View usages"
                                                    >
                                                        <Users className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePromo(promo.id)}
                                                        className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                                                        title="Delete code"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Usages Toggle Area */}
                                            {expandedPromoId === promo.id && (
                                                <div className="bg-zinc-900/50 border-t border-white/5 p-4 animate-in slide-in-from-top-2 duration-300">
                                                    <h4 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-widest">Recent Usages</h4>
                                                    {promo.usages && promo.usages.length > 0 ? (
                                                        <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                                            {promo.usages.map((usage: any) => (
                                                                <div key={usage.id} className="flex items-center justify-between text-xs p-2 bg-black/20 rounded border border-white/5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-zinc-300 font-medium">{usage.user.username}</span>
                                                                        <span className="text-zinc-600 font-mono">({usage.user.email})</span>
                                                                    </div>
                                                                    <span className="text-zinc-600">{new Date(usage.usedAt).toLocaleDateString()}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-zinc-600 italic">No usage history yet.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
