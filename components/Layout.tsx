"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useStore } from '../context/StoreContext';
import { getImageUrl } from '../lib/image';
import {
    Menu, Search, User, LogOut, Bookmark, Coins, LayoutDashboard, X,
    Home, Compass, TrendingUp, Clock, Star, BookMarked, History,
    Bell, Moon, ChevronRight, Library, MessageSquare, Users, Shield, Trash2
} from 'lucide-react';
import { searchMangasAction } from '../lib/actions';

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

// ─── Sidebar Navigation Item ───────────────────────────────────────────────────
const SideNavItem = ({ href, icon, label, active, collapsed }: { href: string; icon: React.ReactNode; label: string; active: boolean; collapsed?: boolean }) => (
    <Link
        href={href}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 group relative
            ${active
                ? 'text-white'
                : 'text-zinc-400 hover:text-white'
            } hover:shadow-[0_0_20px_rgba(174,6,21,0.5)] ${collapsed ? 'justify-center px-0' : ''}`}
        style={{
            backgroundColor: active || undefined ? '#ae0615' : undefined
        }}
    >
        <span className={`w-5 h-5 flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-zinc-500 group-hover:text-white'}`}>
            {icon}
        </span>
        {!collapsed && <span className="truncate">{label}</span>}
    </Link>
);

// ─── Navbar (Top Bar) ─────────────────────────────────────────────────────────
export const Navbar: React.FC = () => {
    const { isAuthenticated, currentUser, logout, notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAllNotifications } = useStore();
    const router = useRouter();
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);
    const [filteredMangas, setFilteredMangas] = useState<any[]>([]);
    const [isDash, setIsDash] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsDash(window.location.hostname.startsWith('dash.'));
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowSearch(false);
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifications(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchQuery.trim()) {
                const results = await searchMangasAction(searchQuery);
                setFilteredMangas(results);
            } else {
                setFilteredMangas([]);
            }
        }, 300);
        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            setShowSearch(false);
            setShowMobileSearch(false);
            router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
    };

    const handleLogout = async () => {
        await logout();
        router.push(isDash ? '/login' : '/');
    };

    return (
        <header className="dusk-topbar">
            {/* Logo */}
            <Link href="/" className="dusk-topbar-logo !w-auto pl-6 pr-4">
                <img src="/logo1.png" alt="Logo" className="h-12 w-auto object-contain" />
            </Link>

            {/* Desktop Search */}
            {!isDash && (
                <div className="hidden md:flex flex-1 max-w-lg ml-8 mr-auto relative" ref={searchRef}>
                    <form onSubmit={handleSearch} className="w-full relative">
                        <input
                            type="text"
                            placeholder="Search for manhwa, manga or author..."
                            className="dusk-search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setShowSearch(true)}
                            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                        />
                        <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 group/btn">
                            <Search className="w-5 h-5 text-primary group-hover/btn:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(220,20,60,0.6)]" />
                        </button>
                    </form>
                    {showSearch && searchQuery && (
                        <div className="dusk-search-dropdown">
                            {filteredMangas.length > 0 ? (
                                filteredMangas.slice(0, 8).map(m => (
                                    <Link key={m.id} href={`/series/${m.slug}`} onClick={() => setSearchQuery('')}
                                        className="flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-lg transition-colors group">
                                        <img src={getImageUrl(m.cover)} alt={m.title} className="w-9 h-12 object-cover rounded" />
                                        <div>
                                            <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{m.title}</h4>
                                            <p className="text-xs text-zinc-500">{m.rating} ★ • {m.status}</p>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="p-4 text-center text-sm text-zinc-500">No results found.</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Right Actions */}
            <div className="flex items-center gap-2 ml-auto">
                {/* Mobile Search Toggle */}
                {!isDash && (
                    <button onClick={() => setShowMobileSearch(!showMobileSearch)}
                        className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <Search className="w-5 h-5" />
                    </button>
                )}

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`p-2 rounded-lg transition-colors relative hidden sm:block ${showNotifications ? 'text-primary bg-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border border-[#0f0709] animate-pulse"></span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-[#12080a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
                            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                                <h3 className="text-sm font-black text-white tracking-widest uppercase">Notifications</h3>
                                <div className="flex items-center gap-3">
                                    <button onClick={markAllAsRead} className="text-[10px] font-bold text-primary hover:underline">Mark all as read</button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            clearAllNotifications();
                                        }}
                                        className="text-[10px] font-bold text-rose-500 hover:underline flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Clear all
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-96 overflow-y-auto dusk-scrollbar">
                                {notifications.length > 0 ? (
                                    notifications.map(notif => (
                                        <div
                                            key={notif.id}
                                            onClick={() => {
                                                markAsRead(notif.id);
                                                if (notif.mangaId) router.push(`/series/${notif.mangaId}`);
                                            }}
                                            className={`p-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer flex gap-3 group ${!notif.isRead ? 'bg-white/[0.01]' : 'opacity-60'}`}
                                        >
                                            {notif.type === 'chapter' ? (
                                                <div className="w-10 h-14 rounded-md overflow-hidden flex-shrink-0 border border-white/10">
                                                    <img src={getImageUrl(notif.cover)} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border ${notif.type === 'like' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-surfaceHighlight border-white/10'}`}>
                                                    {notif.type === 'like' ? <Star className="w-5 h-5 text-rose-500 fill-rose-500" /> : <img src="/logo1.png" alt="" className="w-6 h-6 object-contain opacity-50" />}
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] text-zinc-200 leading-snug">
                                                    {notif.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-zinc-500 font-medium">
                                                        {getTimeAgo(notif.timestamp)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-2 shrink-0">
                                                {!notif.isRead && <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        clearNotification(notif.id);
                                                    }}
                                                    className="p-1.5 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-10 text-center text-zinc-600 text-sm">No notifications yet</div>
                                )}
                            </div>
                            <Link
                                href="/notifications"
                                onClick={() => setShowNotifications(false)}
                                className="block p-4 text-center text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/[0.02] transition-all"
                            >
                                View All Notifications
                            </Link>
                        </div>
                    )}
                </div>


                {/* Auth */}
                {isAuthenticated && currentUser ? (
                    <div className="relative group">
                        <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-surfaceHighlight border border-white/10 overflow-hidden flex items-center justify-center">
                                {currentUser.image
                                    ? <img src={getImageUrl(currentUser.image)} alt="" className="w-full h-full object-cover" />
                                    : <img src="/logo1.png" alt="" className="w-full h-full object-contain p-1" />}
                            </div>
                            <span className="text-sm font-medium hidden sm:block text-white">{currentUser.username}</span>
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-52 bg-[#1a0d10] border border-white/10 rounded-xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 origin-top-right z-50">
                            <div className="p-2 space-y-0.5">
                                <Link href="/buy-coins" className="flex items-center justify-between p-2.5 bg-primary/10 border border-primary/20 rounded-lg mb-2">
                                    <div className="flex items-center gap-2">
                                        <Coins className="w-4 h-4 text-primary" />
                                        <span className="text-primary font-bold text-sm">{currentUser.coins} Coins</span>
                                    </div>
                                </Link>
                                <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg">
                                    <User className="w-4 h-4" /> Profile
                                </Link>
                                <Link href="/profile?tab=bookmarks" className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg">
                                    <Bookmark className="w-4 h-4" /> Bookmarks
                                </Link>
                                {(currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
                                    <Link href="/admin" className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-white/5 rounded-lg font-bold">
                                        <LayoutDashboard className="w-4 h-4" /> Admin Panel
                                    </Link>
                                )}
                                <div className="h-px bg-white/5 my-1" />
                                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg">
                                    <LogOut className="w-4 h-4" /> Logout
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <Link href="/login">
                        <button className="dusk-signin-btn">
                            <User className="w-4 h-4" /> Sign In
                        </button>
                    </Link>
                )}
            </div>

            {/* Mobile Search Bar (expanded) */}
            {showMobileSearch && (
                <div className="absolute top-full left-0 right-0 p-3 bg-[#0f0709]/95 backdrop-blur-xl border-b border-white/10 z-50 md:hidden">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            placeholder="Search manga..."
                            className="dusk-search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Search className="w-5 h-5 text-primary" />
                        </button>
                    </form>
                    {searchQuery && filteredMangas.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {filteredMangas.slice(0, 5).map(m => (
                                <Link key={m.id} href={`/series/${m.slug}`} onClick={() => { setSearchQuery(''); setShowMobileSearch(false); }}
                                    className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors">
                                    <img src={getImageUrl(m.cover)} alt={m.title} className="w-8 h-11 object-cover rounded" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-white">{m.title}</h4>
                                        <p className="text-xs text-zinc-500">{m.rating} ★</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </header>
    );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export const Sidebar: React.FC = () => {
    const { isAuthenticated, currentUser, isSidebarCollapsed, toggleSidebar } = useStore();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const isActive = (href: string) => {
        const [hrefPath, hrefQuery] = href.split('?');
        if (hrefPath !== pathname) return false;
        if (!hrefQuery) {
            // Exact path match: active only if no query params at all
            return !searchParams || searchParams.toString() === '';
        }
        // Build a query string from hrefQuery and compare
        const hrefParams = new URLSearchParams(hrefQuery);
        const currentParams = new URLSearchParams(searchParams?.toString() || '');
        // Check that all hrefParams keys match currentParams
        let allMatch = true;
        hrefParams.forEach((value, key) => {
            if (currentParams.get(key) !== value) allMatch = false;
        });
        if (!allMatch) return false;
        return hrefParams.toString().split('&').length === currentParams.toString().split('&').length;
    };

    const mainNav = [
        { href: '/', icon: <Home className="w-5 h-5" />, label: 'Home' },
        { href: '/search', icon: <Compass className="w-5 h-5" />, label: 'Browse' },
        { href: '/search?sort=views', icon: <TrendingUp className="w-5 h-5" />, label: 'Popular' },
        { href: '/search?sort=latest', icon: <Clock className="w-5 h-5" />, label: 'Latest Updates' },
        { href: '/search?filter=new', icon: <Star className="w-5 h-5" />, label: 'New Releases' },
        { href: '/search?status=completed', icon: <BookMarked className="w-5 h-5" />, label: 'Completed' },
        { href: '/search?view=genres', icon: <Menu className="w-5 h-5" />, label: 'Genres' },
    ];

    if (isAuthenticated) {
        mainNav.push({ href: '/profile?tab=bookmarks', icon: <Bookmark className="w-5 h-5" />, label: 'Bookmarks' });
        mainNav.push({ href: '/profile?tab=history', icon: <History className="w-5 h-5" />, label: 'History' });
    }

    const communityNav = [
        { href: 'https://discord.gg/ZWPMNV7SzK', icon: <MessageSquare className="w-5 h-5" />, label: 'Discord' },
    ];

    return (
        <aside className={`dusk-sidebar hidden lg:flex flex-col ${isSidebarCollapsed ? 'is-collapsed' : ''} relative`}>
            {/* Floating Toggle Button */}
            <button
                onClick={toggleSidebar}
                className={`absolute right-3 top-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white shadow-lg border border-white/10 hover:scale-110 transition-all duration-300 ${isSidebarCollapsed ? 'rotate-0' : 'rotate-180'}`}
            >
                <ChevronRight className="w-4 h-4" />
            </button>

            {/* Main Nav */}
            <nav className={`flex flex-col gap-0.5 mt-12 ${isSidebarCollapsed ? 'px-3' : 'px-2'}`}>
                {mainNav.map(item => (
                    <SideNavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActive(item.href)} collapsed={isSidebarCollapsed} />
                ))}
            </nav>

            {/* Discord CTA */}
            {!isSidebarCollapsed && (
                <div className="mt-auto mx-2 mb-4">
                    <div className="dusk-discord-cta">
                        <div className="relative z-10">
                            <p className="text-sm font-black text-white mb-1">READ. DISCUSS.<br />REPEAT.</p>
                            <p className="text-xs text-zinc-400 mb-3">Join our community of readers!</p>
                            <a href={process.env.NEXT_PUBLIC_DISCORD_URL} target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 bg-primary hover:opacity-90 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors w-full">
                                <MessageSquare className="w-4 h-4" /> Join Discord
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

// ─── Mobile Bottom Navigation ─────────────────────────────────────────────────
export const MobileBottomNav: React.FC = () => {
    const pathname = usePathname();
    const { isAuthenticated } = useStore();

    const items = [
        { href: '/', icon: <Home className="w-5 h-5" />, label: 'Home' },
        { href: '/search', icon: <Compass className="w-5 h-5" />, label: 'Browse' },
        { href: '/', icon: null, label: '', isBrand: true },
        { href: isAuthenticated ? '/profile?tab=bookmarks' : '/login', icon: <Library className="w-5 h-5" />, label: 'My Library' },
        { href: isAuthenticated ? '/profile' : '/login', icon: <User className="w-5 h-5" />, label: 'Profile' },
    ];

    return (
        <nav className="dusk-bottom-nav lg:hidden">
            {items.map((item, i) => {
                if (item.isBrand) {
                    return (
                        <Link key={i} href="/" className="dusk-bottom-nav-brand">
                            <div className="dusk-bottom-nav-brand-inner">
                                <img src="/logo1.png" alt="Logo" className="w-6 h-6 object-contain" />
                            </div>
                        </Link>
                    );
                }
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href.split('?')[0]));
                return (
                    <Link key={i} href={item.href}
                        className={`dusk-bottom-nav-item ${isActive ? 'active' : ''}`}>
                        {item.icon}
                        <span className="text-[10px] font-semibold">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
};

// ─── Footer ───────────────────────────────────────────────────────────────────
export const Footer: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => (
    <footer className={`dusk-footer ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="dusk-footer-inner">
            {/* Brand */}
            <div className="dusk-footer-brand">
                <div className="flex items-center gap-3 mb-3">
                    <img src="/logo1.png" alt="Logo" className="w-14 h-14 object-contain" />
                    <div>
                        <p className="text-sm font-extrabold text-white tracking-tight leading-tight">DUSK SCANS</p>
                    </div>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                    Dive into manga, manhwa, and manhua with fast, smooth translations.<br />
                    Your gateway to endless stories in the dark.
                </p>
            </div>



            <div>
                <h4 className="dusk-footer-heading">SUPPORT</h4>
                <ul className="dusk-footer-links">
                    <li><a href={process.env.NEXT_PUBLIC_DISCORD_URL} target="_blank" rel="noopener noreferrer">Help Center</a></li>
                    <li><a href={process.env.NEXT_PUBLIC_DISCORD_URL} target="_blank" rel="noopener noreferrer">Report Issue</a></li>
                    <li><Link href="/dmca">DMCA</Link></li>
                    <li><a href={process.env.NEXT_PUBLIC_DISCORD_URL} target="_blank" rel="noopener noreferrer">Contact Us</a></li>
                </ul>
            </div>

        </div>

        <div className="dusk-footer-bottom">
            <p className="text-xs text-zinc-600">© 2025 Dusk Scans. All rights reserved.</p>
            <div className="flex items-center gap-4">
                <Link href="/privacy" className="text-xs text-zinc-600 hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="text-xs text-zinc-600 hover:text-white transition-colors">Terms of Service</Link>
            </div>
        </div>
    </footer>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isSidebarCollapsed } = useStore();
    return (
        <div className="dusk-layout">
            <Navbar />
            <div className="dusk-body">
                <Sidebar />
                <main className={`dusk-content ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
                    {children}
                </main>
            </div>
            <Footer collapsed={isSidebarCollapsed} />
            <MobileBottomNav />
        </div>
    );
};


