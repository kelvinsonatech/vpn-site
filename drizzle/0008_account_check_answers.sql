-- Account check, safer rules: only real answers count (answered_at), a "too many missing" verdict
-- sticks per protocol (account_lookup_suspect_at), and an account found again after a miss pauses
-- removals for that protocol (account_lookup_false_miss_at). The per-protocol "has found an
-- account" time is replaced by a check against accounts found since the misses started.
ALTER TABLE "server_protocols" ADD COLUMN "account_lookup_suspect_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "server_protocols" ADD COLUMN "account_lookup_false_miss_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "server_protocols" DROP COLUMN IF EXISTS "account_lookup_ok_at";--> statement-breakpoint
ALTER TABLE "vpn_accounts" ADD COLUMN "answered_at" timestamp with time zone;
