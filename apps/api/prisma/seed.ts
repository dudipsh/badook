import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { businessId: '123456789' },
    update: {},
    create: {
      name: 'חברת בניה לדוגמה',
      businessId: '123456789',
      address: 'תל אביב, רחוב הרצל 1',
      phone: '03-1234567',
      email: 'info@example.com',
    },
  });

  await prisma.companySettings.upsert({
    where: { companyId: company.id },
    update: {},
    create: { companyId: company.id },
  });

  await prisma.companyScanSettings.upsert({
    where: { companyId: company.id },
    update: {},
    create: { companyId: company.id },
  });

  // Platform super admin — lives OUTSIDE any company (companyId = null).
  // Login is OAuth-only, so no password. Set SEED_SUPER_ADMIN_EMAIL to seed one.
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (superAdminEmail) {
    await prisma.user.upsert({
      where: { email: superAdminEmail },
      update: { role: 'SUPER_ADMIN', companyId: null, isActive: true },
      create: {
        email: superAdminEmail,
        name: process.env.SEED_SUPER_ADMIN_NAME || 'Platform Admin',
        role: 'SUPER_ADMIN',
        companyId: null,
        isActive: true,
      },
    });
  } else {
    console.warn('SEED_SUPER_ADMIN_EMAIL not set — skipping super-admin seed.');
  }

  const hash = await bcrypt.hash('password123', 12);

  // Demo-company admin (NOT a platform super admin). Platform super admins live
  // outside any company (companyId = null) and are managed from the super-admin console.
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: hash,
      name: 'מנהל מערכת',
      role: 'ADMIN',
      companyId: company.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'accountant@example.com' },
    update: {},
    create: {
      email: 'accountant@example.com',
      passwordHash: hash,
      name: 'חשבת ראשית',
      role: 'ACCOUNTANT',
      companyId: company.id,
    },
  });

  const suppliers = [
    { name: 'ספק ברזל - מתכת בע"מ', businessId: '111222333', phone: '04-1111111' },
    { name: 'ספק בטון - יציקות לוי', businessId: '444555666', phone: '04-2222222' },
    { name: 'ספק חשמל - אלקטרו פלוס', businessId: '777888999', phone: '04-3333333' },
  ];

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { name_companyId: { name: s.name, companyId: company.id } },
      update: {},
      create: { ...s, companyId: company.id },
    });
  }

  const defaultAgent = await prisma.chatAgent.findFirst({ where: { isDefault: true } });
  if (!defaultAgent) {
    await prisma.chatAgent.create({
      data: {
        name: 'בדוק - עוזר כללי',
        description: 'עוזר בסיסי לשיחות חופשיות (ללא גישה למידע במערכת)',
        systemPrompt: `אתה בדוק (Badook), עוזר AI לצוותי תפעול וכספים בחברות בנייה וקבלנות.
אתה עוזר עם התאמות בין הזמנות רכש (PO), תעודות משלוח (DC) וחשבוניות (INV).
ענה תמיד בעברית. היה מדויק, קצר וענייני. אם אינך יודע — אמור זאת במפורש.`,
        provider: 'GEMINI',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 1500,
        hasTools: false,
        isDefault: false,
        isEnabled: true,
      },
    });
  }

  const dataAgent = await prisma.chatAgent.findFirst({ where: { hasTools: true } });
  if (!dataAgent) {
    await prisma.chatAgent.create({
      data: {
        name: 'בדוק - מומחה דאטה',
        description:
          'סוכן עם גישה מלאה למידע במערכת: פרויקטים, ספקים, חשבוניות, חוסרים והתאמות',
        systemPrompt: `אתה בדוק (Badook), עוזר AI חכם לצוותי תפעול וכספים בחברות בנייה וקבלנות.
יש לך גישה ישירה לנתוני החברה של המשתמש דרך כלים (tools).
כשהמשתמש שואל על פרויקטים, ספקים, חוסרים או סטטיסטיקות — קרא לכלי המתאים והשתמש בתשובה.
לעולם אל תמציא נתונים. אם הכלי החזיר רשימה ריקה, אמור שאין נתונים, אל תמציא.
ענה תמיד בעברית, קצר וענייני. כשמדובר בכספים — הצג סכומים בש"ח עם פורמט מקובל (לדוגמה ₪12,450).
כשמדובר ביחס התאמה — הצג באחוזים.
אם המשתמש שואל שאלה כללית שלא דורשת מידע מהמערכת, ענה ישירות בלי לקרוא לכלים.`,
        provider: 'GEMINI',
        model: 'gemini-2.5-flash',
        temperature: 0.3,
        maxTokens: 2000,
        hasTools: true,
        isDefault: true,
        isEnabled: true,
      },
    });
  }

  console.log('Seed completed successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
