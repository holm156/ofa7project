import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';

// GET: List all promo codes (Admin only)
export async function GET() {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const codes = await prisma.promoCode.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { usages: true } },
                usages: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                username: true,
                                email: true
                            }
                        }
                    },
                    orderBy: { usedAt: 'desc' }
                }
            }
        });
        return NextResponse.json(codes);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch promo codes' }, { status: 500 });
    }
}

// POST: Create a new promo code (Admin only)
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { code, coins, maxUses, expiresAt } = body;

        if (!code || !coins) {
            return NextResponse.json({ error: 'Code and coins are required' }, { status: 400 });
        }

        const promo = await prisma.promoCode.create({
            data: {
                code: code.toUpperCase().trim(),
                coins: Number(coins),
                maxUses: maxUses ? Number(maxUses) : null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            }
        });

        return NextResponse.json(promo);
    } catch (e: any) {
        if (e.code === 'P2002') {
            return NextResponse.json({ error: 'A promo code with this name already exists' }, { status: 409 });
        }
        console.error(e);
        return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 });
    }
}
