import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const inv = await p.invoice.findMany({
    where: { invoiceNumber: '11493' },
    select: { id: true, invoiceNumber: true, originalFileUrl: true, originalFileUrlHq: true, createdAt: true, updatedAt: true, projectId: true },
  });
  console.log('--- Invoice ---');
  console.log(JSON.stringify(inv, null, 2));

  const dn = await p.deliveryNote.findMany({
    where: { noteNumber: '30127' },
    select: { id: true, noteNumber: true, originalFileUrl: true, originalFileUrlHq: true, originalFileName: true, createdAt: true, updatedAt: true },
  });
  console.log('--- DN ---');
  console.log(JSON.stringify(dn, null, 2));
  await p.$disconnect();
})();
