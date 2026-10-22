-- Account check: a server's "not found" answers are trusted per protocol (a lookup can break for one
-- protocol only), so the "has found an account" time moves from servers to server_protocols.
ALTER TABLE "server_protocols" ADD COLUMN "account_lookup_ok_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "servers" DROP COLUMN IF EXISTS "account_lookup_ok_at";
