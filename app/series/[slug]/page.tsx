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

    const baseUrl = process.env.NEXTAUTH_URL || 'https://duskscans.com';

    return {
        title: `${manga.title} - Read Online | DuskScans`,
        description: manga.description?.slice(0, 160) || `Read ${manga.title} online for free with no ads on DuskScans. High-quality images and daily updates.`,
        alternates: {
            canonical: `${baseUrl}/series/${slug}`,
        },
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

    let hash = 0;
    for (let i = 0; i < manga.id.length; i++) {
        hash = manga.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const normalizedRating = 4.0 + ((Math.abs(hash) % 11) / 10);
    const displayRating = manga.rating && Number(manga.rating) > 0 ? Number(manga.rating).toFixed(1) : normalizedRating.toFixed(1);

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
            "ratingValue": displayRating,
            "bestRating": "5",
            "ratingCount": "100"
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
