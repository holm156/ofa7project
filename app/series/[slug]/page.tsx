import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MangaClient from '../../../components/MangaClient';
import { getMangaBySlug, getChaptersByMangaId, getRelatedMangas } from '../../../lib/queries';

// ISR: Cache page for 5 minutes. notFound() ensures 404s are never cached.
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> | { slug: string } }): Promise<Metadata> {
    const { slug } = await Promise.resolve(params);
    const manga = await getMangaBySlug(slug);

    if (!manga) return { title: 'Manga Not Found' };

    return {
        title: `${manga.title} - Read Online | DuskScans`,
        description: manga.description?.slice(0, 160) || `Read ${manga.title} online for free on DuskScans. High-quality images and daily updates.`,
        openGraph: {
            title: manga.title,
            description: manga.description?.slice(0, 160),
            images: [manga.cover],
            type: 'book',
        },
        twitter: {
            card: 'summary_large_image',
            title: manga.title,
            description: manga.description?.slice(0, 160),
            images: [manga.cover],
        },
    };
}

export default async function MangaDetailPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
    const { slug } = await Promise.resolve(params);

    const manga = await getMangaBySlug(slug);

    if (!manga) {
        notFound();
    }

    const [realChapters, relatedMangas] = await Promise.all([
        getChaptersByMangaId(manga.id),
        getRelatedMangas(manga.id, manga.genres)
    ]);

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Book",
        "name": manga.title,
        "description": manga.description,
        "image": manga.cover,
        "author": {
            "@type": "Person",
            "name": manga.author || "Unknown"
        },
        "genre": manga.genres,
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": manga.rating || "0",
            "bestRating": "5",
            "ratingCount": "100" // Placeholder or actual data if available
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <MangaClient
                initialManga={manga}
                initialChapters={realChapters}
                initialComments={[]}
                relatedMangas={relatedMangas}
            />
        </>
    );
}
