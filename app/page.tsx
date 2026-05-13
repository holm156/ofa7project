import React from 'react';
import HomeClient from '../components/HomeClient';
import { getMangas } from '../lib/queries';

// ISR: Regenerate this page at most once every 60 seconds.
// All users get a cached version — no DB hit on every request.
export const revalidate = 60;

export default async function Home() {
    const initialMangas = await getMangas();

    return <HomeClient initialMangas={initialMangas} />;
}
