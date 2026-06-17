import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { COIN_PACKAGES } from "../../../../lib/packages";

// Bonus calculations matching the frontend
const PKG_BONUS: Record<string, number> = {
    'pkg-1': 0,
    'pkg-2': 50,
    'pkg-3': 150,
    'pkg-4': 450,
    'pkg-5': 1200,
};

export async function POST(req: Request) {
    try {
        // Ko-fi sends data as application/x-www-form-urlencoded
        const text = await req.text();
        const searchParams = new URLSearchParams(text);
        const dataStr = searchParams.get('data');

        if (!dataStr) {
            return new NextResponse("No data provided", { status: 400 });
        }

        const payload = JSON.parse(dataStr);

        // Verify token
        if (payload.verification_token !== process.env.KOFI_VERIFICATION_TOKEN) {
            console.error("Invalid Ko-fi verification token");
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const amount = parseFloat(payload.amount);
        const email = payload.email;
        const message = payload.message || "";
        
        // Find user by message (if they typed email/username) or by their Ko-fi email
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: message.trim() },
                    { username: message.trim() },
                    { email: email }
                ]
            }
        });

        if (!user) {
            console.error(`Ko-fi webhook: User not found for email ${email} or message ${message}`);
            // Return 200 anyway so Ko-fi stops retrying
            return new NextResponse("OK", { status: 200 });
        }

        // Determine how many coins to add based on the amount
        let coinsToAdd = 0;
        const pkg = COIN_PACKAGES.find((p: any) => parseFloat(p.price) === amount);
        
        if (pkg) {
            coinsToAdd = pkg.coins + (PKG_BONUS[pkg.id] || 0);
        } else {
            // Fallback: 100 coins per dollar
            coinsToAdd = Math.floor(amount * 100);
        }

        // Add coins to user and get updated user
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                coins: { increment: coinsToAdd }
            }
        });

        // Record the transaction
        await prisma.coinTransaction.create({
            data: {
                userId: user.id,
                amount: coinsToAdd,
                balanceAfter: updatedUser.coins,
                type: "PURCHASE",
                description: `Ko-fi Donation: $${amount}`
            }
        });

        // Send Discord Notification
        if (process.env.DISCORD_KOFI_WEBHOOK_URL) {
            try {
                await fetch(process.env.DISCORD_KOFI_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        embeds: [{
                            title: "💰 New Ko-fi Payment Received!",
                            color: 0x13C3FF,
                            fields: [
                                { name: "User", value: user.username || "Unknown", inline: true },
                                { name: "Amount Paid", value: `$${amount.toFixed(2)}`, inline: true },
                                { name: "Coins Added", value: `${coinsToAdd.toLocaleString()} Coins`, inline: true },
                                { name: "Message", value: message || "No message", inline: false }
                            ],
                            timestamp: new Date().toISOString()
                        }]
                    })
                });
            } catch (err) {
                console.error("Failed to send Discord webhook:", err);
            }
        }

        console.log(`Successfully added ${coinsToAdd} coins to ${user.username} from Ko-fi donation.`);
        return new NextResponse("OK", { status: 200 });

    } catch (error) {
        console.error("Error processing Ko-fi webhook:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
