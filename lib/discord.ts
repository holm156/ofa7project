export async function notifyNewChapter(manga: any, chapter: any, uploaderName: string) {
    const isPaid = chapter.price > 0;
    const webhookUrl = isPaid
        ? process.env.DISCORD_PAID_WEBHOOK_URL
        : process.env.DISCORD_FREE_WEBHOOK_URL;

    if (!webhookUrl) {
        console.error(`Discord webhook URL not found for ${isPaid ? 'paid' : 'free'} chapters.`);
        return;
    }

    // Use the public site URL, NOT NEXTAUTH_URL (which may be set to the admin subdomain)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://duskscans.com';
    const mangaUrl = `${siteUrl}/series/${manga.slug}`;
    const chapterUrl = `${siteUrl}/series/${manga.slug}/chapter-${chapter.number}`;
    const coverUrl = manga.cover ? (manga.cover.startsWith('http') ? manga.cover : `${siteUrl}${manga.cover}`) : null;

    const logoUrl = `${siteUrl}/logo.png`;

    const embed = {
        author: {
            name: "DuskScans",
            icon_url: logoUrl,
            url: siteUrl,
        },
        title: manga.title,
        url: mangaUrl,
        color: 0xda781d, // Updated to brand color #da781d
        fields: [
            {
                name: "Chapter",
                value: `| ${chapter.number}`,
                inline: false
            },
            {
                name: "Uploader",
                value: `| ${uploaderName}`,
                inline: false
            },
            {
                name: "Read",
                value: `| [Read Chapter](${chapterUrl})`,
                inline: false
            }
        ],
        image: coverUrl ? { url: coverUrl } : undefined,
        footer: {
            text: "DuskScans",
            icon_url: logoUrl,
        },
        timestamp: new Date().toISOString()
    };

    const roleId = process.env.DISCORD_ROLE_ID;
    const mangaRoleId = manga.discordRoleId;

    let mentions: string[] = [];

    // Global Role
    if (roleId) {
        if (roleId.toLowerCase() === 'everyone' || roleId.toLowerCase() === 'here') {
            mentions.push(`@${roleId.toLowerCase()}`);
        } else {
            mentions.push(`<@&${roleId}>`);
        }
    }

    // Manga Specific Role (Only for Free chapters)
    if (mangaRoleId && !isPaid) {
        mentions.push(`<@&${mangaRoleId}>`);
    }

    const baseContent = isPaid ? "📢 New Premium Chapter Alert!" : "📢 New Chapter Alert!";
    const content = mentions.length > 0 ? `${mentions.join(' ')} ${baseContent}` : baseContent;

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: content,
                embeds: [embed],
            }),
        });

        if (!response.ok) {
            console.error('Failed to send Discord notification:', await response.text());
        }
    } catch (error) {
        console.error('Error sending Discord notification:', error);
    }
}

export async function notifyCoinTransaction(
    user: any,
    amount: number,
    type: string,
    description: string,
    adminName?: string,
    newBalance?: number,
    notificationType: 'PURCHASE' | 'TRANSACTION' = 'TRANSACTION'
) {
    let webhookUrl = notificationType === 'PURCHASE'
        ? process.env.DISCORD_PURCHASES_WEBHOOK_URL
        : process.env.DISCORD_TRANSACTIONS_WEBHOOK_URL;

    // Fallback if specific webhook is missing
    if (!webhookUrl) {
        webhookUrl = process.env.DISCORD_TRANSACTIONS_WEBHOOK_URL;
    }

    if (!webhookUrl) {
        console.warn('Discord webhook URL for transaction logs not found in .env');
        return;
    }

    const isPositive = amount > 0;
    const color = isPositive ? 0x2ecc71 : 0xe74c3c; // Green for positive, Red for negative
    const symbol = isPositive ? '➕' : '➖';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://duskscans.com';

    const fields = [
        {
            name: "User",
            value: `**${user.username || user.name || 'Unknown'}**\n(${user.email || 'No Email'})`,
            inline: true
        },
        {
            name: "Amount",
            value: `**${Math.abs(amount)}** Coins`,
            inline: true
        },
        {
            name: "Type",
            value: `\`${type}\``,
            inline: true
        }
    ];

    if (newBalance !== undefined) {
        fields.push({
            name: "New Balance",
            value: `**${newBalance}** Coins`,
            inline: true
        });
    }

    if (adminName) {
        fields.push({
            name: "Performed By (Admin)",
            value: `**${adminName}**`,
            inline: true
        });
    }

    fields.push({
        name: "Description",
        value: description || "No description provided",
        inline: false
    });

    const embed = {
        title: isPositive ? `${symbol} Coin Arrival` : `${symbol} Coin Spending`,
        color: color,
        fields: fields,
        footer: {
            text: notificationType === 'PURCHASE' ? "DuskScans Purchases" : "DuskScans Ledger",
            icon_url: `${siteUrl}/logo.png`
        },
        timestamp: new Date().toISOString()
    };

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [embed]
            }),
        });
    } catch (error) {
        console.error('Error sending Discord transaction notification:', error);
    }
}
