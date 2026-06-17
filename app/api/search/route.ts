import { NextResponse } from 'next/server';
import { getMangas } from '../../../lib/queries';

// ISR for API routes: cache the result for 60 seconds.
// All users share one cached response — no DB hit on every search open.
export const revalidate = 60;

export async function GET() {
    const mangas = await getMangas();
    return NextResponse.json(mangas);
}
