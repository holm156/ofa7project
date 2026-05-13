import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';

// Replace with your Discord server (guild) ID
// Get it by going to Discord -> Server Settings -> Widget -> Server ID
const DISCORD_SERVER_ID = process.env.DISCORD_SERVER_ID || '';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return NextResponse.json({ error: 'You must be logged in to use a promo code.' }, { status: 401 });
    }

    // @ts-ignore
    const userId = session.user.id as string;
    // @ts-ignore
    const discordAccessToken = session.user.discordAccessToken as string | undefined;

    try {
        const { code } = await req.json();

        if (!code?.trim()) {
            return NextResponse.json({ error: 'Please enter a promo code.' }, { status: 400 });
        }

        // 1. Find the promo code
        const promo = await prisma.promoCode.findUnique({
            where: { code: code.toUpperCase().trim() },
            include: { usages: { where: { userId } } }
        });

        if (!promo) {
            return NextResponse.json({ error: 'Invalid promo code.' }, { status: 404 });
        }

        // 2. Check expiry
        if (promo.expiresAt && new Date() > promo.expiresAt) {
            return NextResponse.json({ error: 'This promo code has expired.' }, { status: 400 });
        }

        // 3. Check max uses
        if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
            return NextResponse.json({ error: 'This promo code has reached its maximum usage limit.' }, { status: 400 });
        }

        // 4. Check if this user already used this code
        if (promo.usages.length > 0) {
            return NextResponse.json({ error: 'You have already used this promo code.' }, { status: 400 });
        }

        // 5. Check account age (must be at least 3 days old)
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
        if (!user) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }
        const accountAgeDays = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (accountAgeDays < 3) {
            return NextResponse.json({ error: 'Your account must be at least 3 days old to use promo codes.' }, { status: 403 });
        }

        // 6. Check Discord server membership and ID (only if Discord Server ID is set)
        let currentUserDiscordId: string | null = null;
        if (DISCORD_SERVER_ID) {
            if (!discordAccessToken) {
                return NextResponse.json({
                    error: 'You must be logged in with Discord to use promo codes. Please link your Discord account.',
                }, { status: 403 });
            }

            // A. Get Discord User Info (to get their real Discord ID)
            const userRes = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${discordAccessToken}` }
            });

            if (!userRes.ok) {
                return NextResponse.json({ error: 'Could not verify Discord identity. Please try logging out and back in.' }, { status: 401 });
            }

            const discordUser = await userRes.json();
            currentUserDiscordId = discordUser.id;

            // B. Check if this Discord ID has ALREADY used this promo code (on ANY web account)
            const existingDiscordUsage = await prisma.promoUsage.findFirst({
                where: {
                    promoCodeId: promo.id,
                    discordId: currentUserDiscordId
                }
            });

            if (existingDiscordUsage) {
                return NextResponse.json({ error: 'This Discord account has already claimed this promo code.' }, { status: 400 });
            }

            // C. Check Guild Membership
            const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
                headers: { Authorization: `Bearer ${discordAccessToken}` }
            });

            if (!guildsRes.ok) {
                return NextResponse.json({ error: 'Could not verify Discord membership.' }, { status: 400 });
            }

            const guilds: { id: string }[] = await guildsRes.json();
            const isMember = guilds.some(g => g.id === DISCORD_SERVER_ID);

            if (!isMember) {
                return NextResponse.json({
                    error: 'You must be a member of our Discord server to use promo codes.',
                }, { status: 403 });
            }
        }

        // 7. All checks passed — redeem the code atomically
        await prisma.$transaction([
            // Add coins to user
            prisma.user.update({
                where: { id: userId },
                data: { coins: { increment: promo.coins } }
            }),
            // Mark usage
            prisma.promoUsage.create({
                data: { promoCodeId: promo.id, userId, discordId: currentUserDiscordId }
            }),
            // Increment usage count on the code
            prisma.promoCode.update({
                where: { id: promo.id },
                data: { usedCount: { increment: 1 } }
            }),
            // Record in coin transaction history
            prisma.coinTransaction.create({
                data: {
                    userId,
                    amount: promo.coins,
                    type: 'PROMO_CODE',
                    description: `Promo code: ${promo.code}`
                }
            })
        ]);

        return NextResponse.json({ success: true, coins: promo.coins, message: `🎉 You received ${promo.coins} coins!` });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
}
