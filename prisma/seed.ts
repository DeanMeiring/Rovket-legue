import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "change-me-now";

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    // Railway's ADMIN_PASSWORD is the source of truth for this account: every
    // deploy resets the login to it, so changing the variable changes the
    // password. Only when the variable is actually set, never the fallback.
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`Admin user "${username}" already exists; ADMIN_PASSWORD not set, leaving it alone.`);
      return;
    }
    const matches = await bcrypt.compare(process.env.ADMIN_PASSWORD, existing.passwordHash);
    if (matches && existing.role === "ADMIN" && existing.status === "APPROVED") {
      console.log(`Admin user "${username}" already matches ADMIN_PASSWORD.`);
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
        role: "ADMIN",
        status: "APPROVED",
      },
    });
    console.log(`Admin user "${username}" synced to ADMIN_PASSWORD.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role: "ADMIN",
      status: "APPROVED",
      displayName: "Team Manager",
      isPlayer: false,
    },
  });

  console.log(`Created admin user "${username}" <${email}>.`);
  console.log("Log in with the password from ADMIN_PASSWORD.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
