import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;
    const hostname = request.headers.get('host') || '';
    const error = searchParams.get('error');

    // Support both the old dash subdomain and the new main domain /admin path
    const isDashSubdomain = hostname.startsWith('dash.');

    const isAssetOrAuth = ['/_next', '/api/auth', '/uploads', '/images', '/logo.png', '/favicon.ico', '/static'].some(p => pathname.startsWith(p));

    // Fast skip for auth and assets to prevent any interference
    if (isAssetOrAuth) return NextResponse.next();

    // --- Helper function for robust token retrieval ---
    const getRobustToken = async (req: any) => {
        let t = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }).catch(() => null);
        if (t) return t;
        t = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: 'next-auth.session-token' }).catch(() => null);
        if (t) return t;
        t = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: '__Secure-next-auth.session-token' }).catch(() => null);
        return t;
    };

    // --- RULE 1: dash Subdomain Handling (Keep for backward compatibility) ---
    if (isDashSubdomain) {
        const isLoginPage = pathname === '/login';

        if (!isLoginPage) {
            const token = await getRobustToken(request);
            const userRole = (token as any)?.role;

            if (!token) {
                return NextResponse.redirect(new URL('/login', request.url));
            }

            if (userRole === 'user') {
                return NextResponse.redirect(new URL('/login?error=AdminAccessOnly', request.url));
            }

            if (pathname === '/') {
                return NextResponse.rewrite(new URL('/admin', request.url));
            }

            const isAdminArea = pathname.startsWith('/admin') || pathname.startsWith('/api');
            if (!isAdminArea) {
                return NextResponse.redirect(new URL('/', request.url));
            }
        }
    }

    // --- RULE 2: Protect Admin & Admin-API on ALL Domains ---
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        const token = await getRobustToken(request);
        const userRole = (token as any)?.role;

        if (!token) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/login', request.url));
        }

        if (token && userRole !== 'admin' && userRole !== 'moderator') {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    // --- Logic for /login page with error ---
    if (pathname === '/login' && error) {
        const token = await getRobustToken(request);
        if (token && error !== 'AdminAccessOnly') {
            const profileUrl = new URL('/profile', request.url);
            profileUrl.searchParams.set('error', error);
            profileUrl.searchParams.set('tab', 'settings');
            return NextResponse.redirect(profileUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
