"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Zap, Clock, TrendingUp, Star } from 'lucide-react';
import { Comment } from '../types';
import { api } from '../services/api';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import CommentItem from './CommentItem';

interface CommentSectionProps {
    mangaId: string;
    chapterId?: string;
    initialComments?: Comment[];
    onCountChange?: (count: number) => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ mangaId, chapterId, initialComments = [], onCountChange }) => {
    const { currentUser, isAuthenticated } = useStore();
    const { showToast } = useToast();
    const [comments, setComments] = useState<Comment[]>(initialComments);
    const [sortBy, setSortBy] = useState<'newest' | 'best' | 'oldest'>('best');
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRating, setUserRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);

    useEffect(() => {
        if (onCountChange) onCountChange(comments.length);
    }, [comments.length, onCountChange]);

    const fetchComments = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetched = await api.getComments(mangaId, sortBy, chapterId);
            setComments(fetched);
        } catch (e) {
            showToast('Failed to load comments', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [mangaId, sortBy, chapterId, showToast]);

    useEffect(() => {
        // Only fetch if initialComments is empty or sortBy changed from initial 'best'
        // If sorting by 'best', we always fetch if we don't have initial comments
        if (initialComments.length === 0 || sortBy !== 'best') {
            fetchComments();
        }
    }, [sortBy, fetchComments]);

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const posted = await api.addComment(mangaId, newComment, undefined, chapterId);
            if (posted) {
                if (sortBy === 'oldest') {
                    setComments(prev => [...prev, posted]);
                } else {
                    setComments(prev => [posted, ...prev]);
                }
                setNewComment('');
                showToast('Comment posted', 'success');
            }
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="mt-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h3 className="text-2xl font-extrabold flex items-center gap-3 text-white">
                    <MessageSquare className="w-6 h-6 text-[#e11d48]" />
                    Comments
                    <span className="text-sm font-bold bg-[#121212] border border-white/5 px-2.5 py-0.5 rounded-full text-zinc-400">
                        {comments.length}
                    </span>
                </h3>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
                    {/* Rating UI (Only show if not in a specific chapter) */}
                    {!chapterId && (
                        <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner">
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mr-1">Rate:</span>
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        className="transition-transform hover:scale-125 focus:outline-none"
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => {
                                            setUserRating(star);
                                            showToast(`Rated ${star} stars!`, 'success');
                                            // TODO: Call API to save rating
                                        }}
                                    >
                                        <Star 
                                            className={`w-4 h-4 transition-colors duration-200 ${
                                                star <= (hoverRating || userRating)
                                                    ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                                                    : 'text-zinc-600 hover:text-yellow-400/50'
                                            }`} 
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sort Tabs */}
                    <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5 shadow-inner">
                    <button
                        onClick={() => setSortBy('best')}
                        className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'best' ? 'bg-[#e11d48] text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <TrendingUp className="w-3.5 h-3.5" /> Best
                    </button>
                    <button
                        onClick={() => setSortBy('newest')}
                        className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'newest' ? 'bg-[#e11d48] text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <Zap className="w-3.5 h-3.5" /> Newest
                    </button>
                    <button
                        onClick={() => setSortBy('oldest')}
                        className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'oldest' ? 'bg-[#e11d48] text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <Clock className="w-3.5 h-3.5" /> Oldest
                    </button>
                </div>
                </div>
            </div>

            {/* Post Comment */}
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 mb-10 shadow-xl">
                {isAuthenticated ? (
                    <form onSubmit={handleCommentSubmit} className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#e11d48] flex items-center justify-center text-white font-bold shrink-0 text-lg shadow-[0_0_15px_rgba(225,29,72,0.3)] border border-white/10 overflow-hidden">
                            {currentUser?.image ? (
                                <img src={currentUser.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                                (currentUser?.username || 'U')[0]?.toUpperCase()
                            )}
                        </div>
                        <div className="flex-1 flex flex-col gap-3">
                            <textarea
                                className="w-full bg-[#0a0a0a] rounded-xl px-4 py-3 border border-white/10 focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48] text-white placeholder:text-zinc-600 transition-all resize-none h-24 text-sm"
                                placeholder="What's on your mind? Join the discussion..."
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={!newComment.trim() || isSubmitting}
                                    className="bg-[#e11d48] hover:bg-[#be123c] text-white font-bold px-6 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                                >
                                    {isSubmitting ? 'Posting...' : 'Post Comment'}
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="text-center py-6">
                        <p className="text-zinc-500 mb-4">You need to be logged in to participate in the conversation.</p>
                        <a href="/login" className="inline-flex items-center gap-2 bg-[#e11d48] hover:bg-[#be123c] text-white font-bold px-8 py-2.5 rounded-xl transition-colors shadow-[0_0_15px_rgba(225,29,72,0.3)]">
                            Sign In / Register
                        </a>
                    </div>
                )}
            </div>

            {/* Comments List */}
            <div className={`space-y-4 relative min-h-[200px] transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
                {comments.length > 0 ? (
                    comments.map(comment => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            mangaId={mangaId}
                            chapterId={chapterId}
                            onDelete={(id) => setComments(prev => prev.filter(c => c.id !== id))}
                        />
                    ))
                ) : !isLoading && (
                    <div className="text-center py-20 bg-zinc-900/20 rounded-3xl border border-dashed border-white/5">
                        <MessageSquare className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                        <p className="text-zinc-600 italic font-medium">No comments yet. Be the first to start the discussion!</p>
                    </div>
                )}

                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default CommentSection;
