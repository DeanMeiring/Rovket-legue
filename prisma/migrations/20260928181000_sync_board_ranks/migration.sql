-- One-time catch-up: tryout board entries that are linked to an account take
-- the account's 2v2 and 3v3 ranks where the account has them. From now on the
-- app keeps the two in step.
UPDATE "TryoutPlayer" AS tp
SET "rank2v2" = COALESCE(u."rank2v2", tp."rank2v2"),
    "rank3v3" = COALESCE(u."rank3v3", tp."rank3v3")
FROM "User" AS u
WHERE tp."userId" = u."id";
