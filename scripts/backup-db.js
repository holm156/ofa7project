const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// إعدادات المسارات
const BACKUP_DIR = path.join(process.cwd(), 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

// قراءة بيانات الاتصال من البيئة (أو ملف .env يدوياً لو مش موجودة)
let dbUrl = process.env.DB_URL;
let webhookUrl = process.env.DISCORD_BACKUP_WEBHOOK_URL;

if (!dbUrl || !webhookUrl) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          if (key.trim() === 'DB_URL') dbUrl = value;
          if (key.trim() === 'DISCORD_BACKUP_WEBHOOK_URL') webhookUrl = value;
        }
      });
    }
  } catch (e) {
    console.error("Error reading .env file:", e);
  }
}

if (!dbUrl || !webhookUrl) {
  console.error("Missing DB_URL or DISCORD_BACKUP_WEBHOOK_URL in environment or .env file.");
  process.exit(1);
}

// تحليل الـ DB_URL (صيغة: mysql://user:pass@host:port/db)
const regex = /mysql:\/\/([^:]+)(?::([^@]+))?@([^:/]+)(?::(\d+))?\/([^?]+)/;
const matches = dbUrl.match(regex);

if (!matches) {
  console.error("Invalid DB_URL format. Expected mysql://user:pass@host:port/db");
  process.exit(1);
}

const [, user, password, host, port, database] = matches;
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `backup-${database}-${timestamp}.sql`);
const zipFile = `${backupFile}.gz`;

console.log(`Starting backup for database: ${database}...`);

try {
  // 1. تنفيذ امر mysqldump
  const passArg = password ? `-p${password}` : '';
  const portArg = port ? `-P${port}` : '';
  const dumpCmd = `mysqldump -h ${host} ${portArg} -u ${user} ${passArg} ${database} > "${backupFile}"`;
  
  execSync(dumpCmd);
  console.log("Dump created successfully.");

  // 2. ضغط الملف بـ gzip
  execSync(`gzip -f "${backupFile}"`);
  console.log("File zipped successfully.");

  // 3. إرسال إلى ديسكورد باستخدام native fetch (Node 18+)
  async function sendToDiscord() {
    const stats = fs.statSync(zipFile);
    const formData = new FormData();
    
    // محتوى الرسالة
    const content = `📦 **نسخة احتياطية جديدة لقاعدة البيانات**\n📅 التاريخ: ${new Date().toLocaleString()}\n🗂 الملف: \`${path.basename(zipFile)}\`\n⚖️ الحجم: ${(stats.size / 1024 / 1024).toFixed(2)} MB`;
    
    formData.append('payload_json', JSON.stringify({ content }));
    const fileBuffer = fs.readFileSync(zipFile);
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, path.basename(zipFile));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      console.log("Backup sent to Discord successfully!");
      // حذف الملف المؤقت بعد الإرسال للحفاظ على المساحة
      fs.unlinkSync(zipFile);
    } else {
      const errText = await response.text();
      console.error("Failed to send backup to Discord:", errText);
    }
  }

  sendToDiscord();

} catch (error) {
  console.error("Error during backup process:", error);
  process.exit(1);
}
