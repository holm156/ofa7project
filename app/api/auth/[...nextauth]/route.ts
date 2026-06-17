import NextAuth from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { NextRequest } from "next/server";

async function auth(req: NextRequest, ctx: any) {
    // Dynamically set NEXTAUTH_URL based on the actual request origin.
    // This fixes login/logout on dash.duskscans.com where NEXTAUTH_URL=https://duskscans.com
    // would cause a mismatch and silently break authentication.
    const host = req.headers.get('host') || '';
    const protocol = host.includes('localhost') ? 'http://' : 'https://';
    process.env.NEXTAUTH_URL = `${protocol}${host}`;
    process.env.NEXTAUTH_URL_INTERNAL = `${protocol}${host}`;

    return await NextAuth(authOptions)(req, ctx);
}

export { auth as GET, auth as POST };