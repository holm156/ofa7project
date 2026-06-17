import { getMangaById } from '../../../lib/queries';
import { redirect } from 'next/navigation';

// ISR: Regenerate at most once every 5 minutes.
export const revalidate = 300;

export default async function MangaDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
    const { id } = await Promise.resolve(params);

    const manga = await getMangaById(id);

    if (!manga) {
        return <div className="text-center py-20 text-white text-xl font-bold">Manga not found</div>;
    }

    redirect(`/series/${manga.slug}`);
}