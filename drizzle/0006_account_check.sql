-- Account check: the worker asks each server whether its active accounts still exist and marks the
-- ones the server deleted (for example by a multi-login limiter) as "removed".
-- ADD VALUE is allowed inside the migration transaction because nothing here uses the new value.
ALTER TYPE "public"."account_status" ADD VALUE IF NOT EXISTS 'removed';--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "account_lookup_ok_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vpn_accounts" ADD COLUMN "checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vpn_accounts" ADD COLUMN "missing_since" timestamp with time zone;