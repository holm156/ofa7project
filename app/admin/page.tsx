import React from 'react';
import AdminClient from '../../components/AdminClient';
import { getMangas } from '../../lib/queries';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    // Fast initial fetch using prisma
    const initialMangas = await getMangas();

    return <AdminClient initialMangas={initialMangas} />;
}
