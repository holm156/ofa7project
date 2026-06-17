import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { username, txId, amount, package: pkgName } = await req.json();

        if (!username || !txId) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const webhookUrl = process.env.DISCORD_BINANCE_WEBHOOK_URL;
        if (webhookUrl) {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: "₿ New Binance Crypto Payment — Needs Review!",
                        color: 0xFCD535,
                        fields: [
                            { name: "👤 Username / Email", value: username, inline: true },
                            { name: "💰 Amount", value: `$${amount} USDT`, inline: true },
                            { name: "📦 Package", value: pkgName, inline: true },
                            { name: "🔗 Transaction ID (TxID)", value: `\`${txId}\``, inline: false },
                        ],
                        footer: { text: "Please verify and add coins manually via the Admin Panel." },
                        timestamp: new Date().toISOString()
                    }]
                })
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Binance notify error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
