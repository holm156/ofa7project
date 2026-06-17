import React from 'react';
import SearchClient from '../../components/SearchClient';
import { getMangas } from '../../lib/queries';
import { unstable_cache } from 'next/cache';

// Cache the getMangas call for 60 seconds on the server side.
// Same caching benefit as an API route, but without JSON serialization issues.
const getCachedMangas = unstable_cache(
    async () => getMangas(),
    ['search-mangas'],
    { revalidate: 60 }
);

export default async function SearchPage() {
    const allMangas = await getCachedMangas();
    return <SearchClient initialMangas={allMangas} />;
}
