import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  try {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const prisma = new PrismaClient({ adapter });

    console.log("Connecting...");
    const userExists = await prisma.user.findUnique({ where: { email: 'test@test.com' } });
    console.log("Result:", userExists);
  } catch (e: any) {
    console.error("Error message:", e.message);
    console.error("Stack:", e.stack);
  }
}

main();
