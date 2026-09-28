import { z } from "zod";

// "Add admin" form in the admin panel. Staff admins log in like everyone
// else but aren't counted as players.
export const newAdminSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a name.").max(80),
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username must be 40 characters or fewer")
    .regex(/^[^\x00-\x1F\x7F]+$/, "Username contains invalid characters"),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  isPlayer: z.boolean().default(false),
});
