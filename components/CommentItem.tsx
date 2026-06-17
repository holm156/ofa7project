"use client";

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Reply, ChevronDown, ChevronUp, MoreHorizontal, Trash2 } from 'lucide-react';
import { Comment } from '../types';
import { api } from '../services/api';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';

interface CommentItemProps {
    comment: Comment;
    mangaId: string;
    chapterId?: string;
    depth?: number;
    onDelete?: (id: string) => void;
    onReplySuccess?: (newComment: Comment) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment: initialComment, mangaId, chapterId, depth = 0, onDelete, onReplySuccess }) => {
    const { currentUser, isAuthenticated } = useStore();
    const { showToast } = useToast();
    const [comment, setComment] = useState(initialComment);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReplies, setShowReplies] = useState(false);
    const [replies, setReplies] = useState<Comment[]>(comment.replies || []);
    const [isLoadingReplies, setIsLoadingReplies] = useState(false);

    const handleVote = async (type: 1 | -1) => {
        if (!isAuthenticated) {
            showToast('Please login to vote', 'error');
            return;
        }

        const newType = comment.userVote === type ? 0 : type;

        // Optimistic update
        const oldVote = comment.userVote;
        setComment(prev => ({
            ...prev,
            userVote: newType,
            likes: newType === 1 ? prev.likes + 1 : (oldVote === 1 ? prev.likes - 1 : prev.likes),
            dislikes: newType === -1 ? prev.dislikes + 1 : (oldVote === -1 ? prev.dislikes - 1 : prev.dislikes)
        }));

        try {
            const result = await api.voteComment(comment.id, newType);
            setComment(prev => ({
                ...prev,
                likes: result.likes,
                dislikes: result.dislikes,
                userVote: result.userVote as 1 | -1 | 0
            }));
        } catch (e) {
            // Revert on error
            setComment(prev => ({ ...prev, userVote: oldVote }));
            showToast('Failed to vote', 'error');
        }
    };


    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyContent.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Flat Threading: If this is already a reply (depth > 0), the actual parent is comment.parentId
            const actualParentId = depth > 0 ? comment.parentId : comment.id;
            const newReply = await api.addComment(mangaId, replyContent, actualParentId, chapterId);

            if (newReply) {
                if (onReplySuccess) {
                    onReplySuccess(newReply);
                } else {
                    // This is the top-level parent adding a reply to itself
                    setReplies(prev => [newReply, ...prev]);
                    setShowReplies(true);
                }
                setReplyContent('');
                setShowReplyForm(false);
                showToast('Reply posted', 'success');
            }
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this comment?')) return;

        try {
            await api.deleteComment(comment.id);
            showToast('Comment deleted', 'success');
            if (onDelete) onDelete(comment.id);
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const fetchReplies = async () => {
        if (replies.length > 0) {
            setShowReplies(!showReplies);
            return;
        }

        setIsLoadingReplies(true);
        try {
            const fetched = await api.getReplies(mangaId, comment.id);
            setReplies(fetched);
            setShowReplies(true);
        } catch (e) {
            showToast('Failed to load replies', 'error');
        } finally {
            setIsLoadingReplies(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className={`flex gap-3 ${depth > 0 ? 'mt-4 ml-4 md:ml-10 border-l-2 border-white/5 pl-4' : 'mt-6'}`}>
            {/* Avatar */}
            <div className="shrink-0">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden">
                    {comment.userImage ? (
                        <img src={comment.userImage} alt={comment.username} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-sm font-bold text-zinc-500">{(comment.username || 'A')[0].toUpperCase()}</span>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-zinc-200 truncate">{comment.username}</span>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                        {comment.chapterNumber != null && (
                            <span className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary font-bold border border-primary/20 shrink-0 uppercase">
                                CH {comment.chapterNumber}
                            </span>
                        )}
                        <span className="text-[10px] text-zinc-600 font-medium whitespace-nowrap">• {formatDate(comment.date)}</span>
                    </div>
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed break-words">
                    {comment.content}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-4 mt-2">
                    <button
                        onClick={() => handleVote(1)}
                        className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${comment.userVote === 1 ? 'text-primary' : 'text-zinc-500 hover:text-white'}`}
                    >
                        <ThumbsUp className={`w-3.5 h-3.5 ${comment.userVote === 1 ? 'fill-current' : ''}`} />
                        <span>{comment.likes}</span>
                    </button>

                    <button
                        onClick={() => handleVote(-1)}
                        className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${comment.userVote === -1 ? 'text-red-500' : 'text-zinc-500 hover:text-white'}`}
                    >
                        <ThumbsDown className={`w-3.5 h-3.5 ${comment.userVote === -1 ? 'fill-current' : ''}`} />
                        <span>{comment.dislikes}</span>
                    </button>

                    <button
                        onClick={() => {
                            setShowReplyForm(!showReplyForm);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
                    >
                        <Reply className="w-3.5 h-3.5" />
                        <span>Reply</span>
                    </button>

                    {(currentUser?.id === comment.userId || currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
                        <button
                            onClick={handleDelete}
                            className="text-zinc-600 hover:text-red-500 transition-colors ml-auto"
                            title="Delete comment"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Reply Form */}
                {showReplyForm && (
                    <form onSubmit={handleReply} className="mt-3 flex gap-2 animate-in slide-in-from-top-2 duration-200">
                        <input
                            autoFocus
                            className="flex-1 bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-700"
                            placeholder="Write a reply..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={!replyContent.trim() || isSubmitting}
                            className="bg-primary hover:bg-primaryDark text-white text-xs font-bold px-4 py-1.5 rounded-lg disabled:opacity-50"
                        >
                            Post
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowReplyForm(false)}
                            className="text-zinc-500 hover:text-white text-xs px-2"
                        >
                            Cancel
                        </button>
                    </form>
                )}

                {/* Replies Toggle */}
                {(comment.replyCount > 0 || replies.length > 0) && (
                    <button
                        onClick={fetchReplies}
                        className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primaryDark transition-colors"
                    >
                        {isLoadingReplies ? (
                            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : showReplies ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>{showReplies ? 'Hide replies' : `Show ${comment.replyCount || replies.length} replies`}</span>
                    </button>
                )}

                {/* Nested Replies */}
                {showReplies && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                        {replies.map(reply => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                mangaId={mangaId}
                                chapterId={chapterId}
                                depth={depth + 1}
                                onDelete={(id) => setReplies(prev => prev.filter(r => r.id !== id))}
                                onReplySuccess={(newReply) => {
                                    setReplies(prev => [newReply, ...prev]);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommentItem;
