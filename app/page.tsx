import type { Metadata } from 'next';
import HomeClient from '../components/HomeClient';
import { getMangas } from '../lib/queries';

export const metadata: Metadata = {
    title: 'DuskScans - Read Manga Online',
    description: 'Read the latest manga online for free on DuskScans.',
};

export const revalidate = 300;

export default async function HomePage() {
    const mangas = await getMangas();
    
    return (
        <main>
            <HomeClient initialMangas={mangas} />
        </main>
    );
}
