"use client";

import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Bell, Check, Trash2, ChevronRight, MessageSquare, Star, BookOpen, Clock } from 'lucide-react';
import { getImageUrl } from '../lib/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function NotificationsClient() {
    const { notifications, markAsRead, markAllAsRead, clearNotification, clearAllNotifications, unreadCount } = useStore();
    const [filter, setFilter] = useState<'all' | 'chapter' | 'interaction'>('all');
    const router = useRouter();

    const filteredNotifs = notifications.filter(n => {
        if (filter === 'all') return true;
        if (filter === 'chapter') return n.type === 'chapter';
        return n.type === 'reply' || n.type === 'like';
    });

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 min-h-[70vh]">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(217,70,239,0.15)]">
                            <Bell className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Notifications</h1>
                    </div>
                    <p className="text-zinc-500 text-sm font-medium">Stay updated with your followed series and community interactions.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={markAllAsRead}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-xs font-bold hover:bg-white/10 transition-all active:scale-95"
                    >
                        <Check className="w-4 h-4" />
                        Mark all as read
                    </button>
                    <button 
                        onClick={clearAllNotifications}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold hover:bg-rose-500/20 transition-all active:scale-95"
                    >
                        <Trash2 className="w-4 h-4" />
                        Clear all
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 dusk-scrollbar">
                {[
                    { id: 'all', label: 'All Activity', icon: <Bell className="w-4 h-4" /> },
                    { id: 'chapter', label: 'New Chapters', icon: <BookOpen className="w-4 h-4" /> },
                    { id: 'interaction', label: 'Interactions', icon: <MessageSquare className="w-4 h-4" /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilter(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold border transition-all whitespace-nowrap
                            ${filter === tab.id 
                                ? 'bg-primary/20 border-primary/40 text-primary shadow-[0_0_15px_rgba(217,70,239,0.2)]' 
                                : 'bg-white/5 border-white/5 text-zinc-500 hover:text-white hover:border-white/10'}`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="space-y-3">
                {filteredNotifs.length > 0 ? (
                    filteredNotifs.map((notif, idx) => (
                        <div 
                            key={notif.id}
                            onClick={() => {
                                markAsRead(notif.id);
                                if (notif.mangaId) router.push(`/series/${notif.mangaId}`);
                            }}
                            className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300
                                ${!notif.isRead 
                                    ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-primary/30 shadow-lg' 
                                    : 'bg-transparent border-white/5 opacity-60 hover:opacity-100 hover:bg-white/[0.02]'}`}
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            {/* Icon/Cover */}
                            <div className="relative shrink-0">
                                {notif.type === 'chapter' ? (
                                    <div className="w-14 h-20 rounded-lg overflow-hidden border border-white/10 shadow-xl group-hover:scale-105 transition-transform duration-500">
                                        <img src={getImageUrl(notif.cover)} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110 duration-500
                                        ${notif.type === 'like' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                                        {notif.type === 'like' ? <Star className="w-7 h-7 fill-current" /> : <MessageSquare className="w-7 h-7" />}
                                    </div>
                                )}
                                {!notif.isRead && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-[#0a0a0a] animate-pulse" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md
                                        ${notif.type === 'chapter' ? 'bg-indigo-500/10 text-indigo-400' : 
                                          notif.type === 'like' ? 'bg-rose-500/10 text-rose-400' : 'bg-primary/10 text-primary'}`}>
                                        {notif.type}
                                    </span>
                                    <span className="text-[10px] text-zinc-600 font-bold flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {getTimeAgo(notif.timestamp)}
                                    </span>
                                </div>
                                <h3 className={`text-[15px] font-bold leading-tight group-hover:text-primary transition-colors ${!notif.isRead ? 'text-white' : 'text-zinc-400'}`}>
                                    {notif.message}
                                </h3>
                                {notif.type === 'reply' && (
                                    <p className="text-xs text-zinc-500 mt-2 italic line-clamp-1 border-l-2 border-white/10 pl-3 py-1 bg-white/[0.01] rounded-r-md">
                                        "{notif.user} replied to your comment..."
                                    </p>
                                )}
                            </div>

                            {/* Action */}
                            <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearNotification(notif.id);
                                    }}
                                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center text-zinc-400 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400">
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center glass-card rounded-3xl border-dashed border-white/10">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                            <Bell className="w-10 h-10 text-zinc-700" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">No Notifications Found</h2>
                        <p className="text-zinc-500 max-w-xs text-center text-sm">
                            Try changing your filters or check back later for new updates.
                        </p>
                        <button 
                            onClick={() => setFilter('all')}
                            className="mt-6 text-primary font-bold text-sm hover:underline"
                        >
                            Reset all filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
