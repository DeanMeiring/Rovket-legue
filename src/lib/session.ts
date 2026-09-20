import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireApprovedUser() {
  const user = await getCurrentUser();
  if (!user || user.status !== "APPROVED") return null;
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || user.status !== "APPROVED") return null;
  return user;
}
