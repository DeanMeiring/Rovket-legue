import { readFileSync } from "fs";
import path from "path";

// The coaching reference every AI review is judged against: benchmarks for
// ballchasing stats by rank, coaching principles and drills, with sources. It
// lives in src/content/coaching-reference.md so it can be read and edited on
// GitHub; admins can read it at /admin/coaching-reference.
export const COACHING_REFERENCE_PATH = path.join(process.cwd(), "src/content/coaching-reference.md");

export function coachingReference(): string {
  try {
    return readFileSync(COACHING_REFERENCE_PATH, "utf8");
  } catch {
    return "";
  }
}
