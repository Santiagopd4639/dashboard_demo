import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@demo.com";
  const existing = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    console.log("Admin ya existe:", email);
    return;
  }

  const passwordHash = await bcrypt.hash("Admin123!", 10);
  await prisma.usuario.create({
    data: {
      email,
      passwordHash,
      rol: "admin",
      activo: true,
    },
  });

  console.log("Admin creado:", email, "password: Admin123!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
