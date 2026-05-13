
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  bookmarks: string[]; // Keep for compatibility
  detailedBookmarks?: { mangaId: string; createdAt: string }[];
  history: { mangaId: string; chapterId: string; timestamp: number }[];
  coins: number;
  unlockedChapters: string[]; // IDs of chapters bought
  image?: string; // Profile picture URL
  linkedAccounts: string[]; // e.g., ['discord', 'google']
  hasPassword: boolean;
  updatedAt?: string;
  notificationsEnabled?: boolean;
  commentRepliesEnabled?: boolean;
  likeNotificationsEnabled?: boolean;
}

export interface Chapter {
  id: string;
  mangaId: string;
  title: string;
  number: number;
  releaseDate: string;
  pages: string[]; // URLs
  price: number; // 0 = Free
  freeDate?: string; // Date when it becomes free automatically
  sourceName?: string;
  sourceColor?: string;
}

export interface Manga {
  id: string;
  title: string;
  cover: string;
  backgroundImage?: string; // New field for Hero Slider
  description: string;
  author: string;
  status: 'Ongoing' | 'Completed' | 'Hiatus';
  type: 'Manga' | 'Manhwa' | 'Manhua';
  rating: number;
  userRatings: { userId: string; rating: number }[]; // Track individual ratings
  views: number;
  viewHistory: number[]; // Array of timestamps for trending calculation
  genres: string[];
  updatedAt: string;
  slug: string;
  uploaderName?: string;
  isFeatured?: boolean; // New DB field for Slider
  chapters?: Chapter[];
  discordRoleId?: string;
  releaseYear?: string;
  chapterCount: number;
}

export interface Comment {
  id: string;
  mangaId: string;
  chapterId?: string;
  chapterNumber?: number;
  userId: string;
  username: string;
  userImage?: string;
  content: string;
  date: string;
  parentId?: string;
  likes: number;
  dislikes: number;
  userVote?: 1 | -1 | 0;
  replyCount: number;
  replies?: Comment[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}