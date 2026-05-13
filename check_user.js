const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser(email) {
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            unlockedChapters: {
                include: {
                    chapter: {
                        include: { manga: true }
                    }
                }
            },
            coinTransactions: true
        }
    });

    if (!user) {
        console.log("User not found");
        return;
    }

    console.log("User:", user.username, "(", user.email, ")");
    console.log("Coins:", user.coins);
    console.log("\nUnlocked Chapters:");
    user.unlockedChapters.forEach(uc => {
        console.log(`- ${uc.chapter.manga.title} Ch.${uc.chapter.number} (Unlocked: ${uc.createdAt})`);
    });

    console.log("\nTransactions:");
    user.coinTransactions.forEach(t => {
        console.log(`- ${t.type}: ${t.amount} (${t.description}) [${t.createdAt}]`);
    });
}

// Usage: node check_user.js <email>
const emailArg = process.argv[2];
if (!emailArg) {
    console.log("Usage: node check_user.js <email>");
    process.exit(1);
}

checkUser(emailArg)
    .catch(console.error)
    .finally(() => prisma.$disconnect());
