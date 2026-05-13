import React from 'react';
import type { Metadata } from 'next';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import ReaderClient from '../../../../components/ReaderClient';
import { getMangaBySlug, getChaptersByMangaId, getChapterByNumber, getCommentsByMangaId, getRelatedMangas } from '../../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string, chapterNumber: string }> | { slug: string, chapterNumber: string } }): Promise<Metadata> {
    const { slug, chapterNumber } = await Promise.resolve(params);
    const manga = await getMangaBySlug(slug);

    if (!manga) return { title: 'Manga Not Found' };

    const num = parseFloat(chapterNumber.replace('chapter-', ''));

    return {
        title: `Read ${manga.title} Chapter ${num} Online - DuskScans`,
        description: `Read ${manga.title} chapter ${num} online for free. High-quality images for ${manga.title} and many more manga.`,
        openGraph: {
            title: `${manga.title} Chapter ${num}`,
            description: `Read ${manga.title} chapter ${num} on DuskScans.`,
            images: [manga.cover],
            type: 'article',
        }
    };
}

export default async function ReaderPage({ params }: { params: Promise<{ slug: string, chapterNumber: string }> | { slug: string, chapterNumber: string } }) {
    const { slug, chapterNumber } = await Promise.resolve(params);

    const manga = await getMangaBySlug(slug);

    if (!manga) {
        return <div className="text-center py-20 text-white font-bold text-xl">Manga not found</div>;
    }

    // Convert slug chapter-37 -> 37
    const num = parseFloat(chapterNumber.replace('chapter-', ''));

    const [chapter, chaptersList, relatedMangas] = await Promise.all([
        getChapterByNumber(manga.id, num),
        getChaptersByMangaId(manga.id),
        getRelatedMangas(manga.id, manga.genres)
    ]);

    if (!chapter) {
        return <div className="text-center py-20 text-white font-bold text-xl">Chapter not found</div>;
    }

    // --- SERVER-SIDE SECURITY LOGIC ---
    const session = await getServerSession(authOptions);
    let userFromDb = null;

    if (session?.user?.email) {
        userFromDb = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { unlockedChapters: true }
        });
    }

    const isAdminOrMod = userFromDb?.role === 'admin' || userFromDb?.role === 'moderator';
    const unlockedChapterIds = userFromDb?.unlockedChapters.map(uc => uc.chapterId) || [];

    const canViewChapter = (ch: any) => {
        if (isAdminOrMod) return true;
        const isFreeByTime = ch.freeDate && new Date() > new Date(ch.freeDate);
        const isPaidAndLocked = ch.price > 0 && !isFreeByTime;

        if (isPaidAndLocked) {
            return unlockedChapterIds.includes(ch.id);
        }
        return true;
    };

    // Strip pages if locked
    if (!canViewChapter(chapter)) {
        chapter.pages = [];
    } else {
        chapter.pages = Array.isArray(chapter.pages) ? chapter.pages : (typeof chapter.pages === 'string' ? JSON.parse(chapter.pages) : []);
    }

    const safeChaptersList = chaptersList.map((ch) => {
        const canView = canViewChapter(ch);
        const pages = canView ? (typeof ch.pages === 'string' ? JSON.parse(ch.pages) : (Array.isArray(ch.pages) ? ch.pages : [])) : [];
        return { 
            ...ch, 
            pages: ch.id === chapter.id ? chapter.pages : [] 
        };
    });

    const comments = await getCommentsByMangaId(manga.id, chapter.id, userFromDb?.id, 'best');

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": `${manga.title} - Chapter ${num}`,
        "headline": `${manga.title} - Chapter ${num}`,
        "description": `Read ${manga.title} chapter ${num} on DuskScans.`,
        "image": manga.cover,
        "author": {
            "@type": "Person",
            "name": manga.author || "Unknown"
        },
        "isPartOf": {
            "@type": "Series",
            "name": manga.title,
            "url": `https://duskscans.com/series/${manga.slug}` // Replace with actual domain if known
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ReaderClient
                mangaId={manga.id}
                chapterId={chapter.id}
                initialManga={manga}
                initialChapters={safeChaptersList as any}
                initialComments={comments}
                relatedMangas={relatedMangas}
            />
        </>
    );
}
