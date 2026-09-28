import { z } from "zod";

export const claimSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});
