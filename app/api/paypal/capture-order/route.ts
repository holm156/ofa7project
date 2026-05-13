import { NextResponse } from "next/server";
import { capturePayPalOrder, COIN_PACKAGES } from "../../../../lib/paypal";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { notifyCoinTransaction } from "../../../../lib/discord";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-ignore
    const userId = session.user.id;

    try {
        const { orderId } = await req.json();
        const captureData = await capturePayPalOrder(orderId);

        if (captureData.status === "COMPLETED") {
            const packageId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id;
            const pkg = COIN_PACKAGES.find(p => p.id === packageId);

            if (!pkg) {
                console.error("Package not found for ID:", packageId);
                return NextResponse.json({ error: "Could not identify the package purchased", details: captureData }, { status: 400 });
            }

            // Update DB
            const updatedUser = await prisma.$transaction(async (tx) => {
                const user = await tx.user.update({
                    where: { id: userId },
                    data: { coins: { increment: pkg.coins } }
                });

                await tx.coinTransaction.create({
                    data: {
                        userId,
                        amount: pkg.coins,
                        // @ts-ignore
                        balanceAfter: user.coins,
                        type: "PURCHASE",
                        description: `Bought ${pkg.name} (${pkg.coins} coins)`
                    }
                });

                return user;
            });

            // Notify Discord
            notifyCoinTransaction(
                updatedUser,
                pkg.coins,
                "PURCHASE",
                `Bought ${pkg.name}`,
                undefined,
                updatedUser.coins,
                'PURCHASE'
            ).catch(console.error);

            return NextResponse.json({
                success: true,
                newBalance: updatedUser.coins
            });
        }

        console.error("PayPal Capture Failed. Status:", captureData.status, "Details:", JSON.stringify(captureData, null, 2));
        return NextResponse.json({
            error: "Payment not completed",
            status: captureData.status,
            details: captureData
        }, { status: 400 });

    } catch (error: any) {
        console.error("Full PayPal Capture Exception:", error);
        return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
    }
}
