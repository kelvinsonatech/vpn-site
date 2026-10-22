-- Account check: what the server says about accounts it still has but does not let connect (banned by
-- its multi-login limiter, expired early). Display only.
ALTER TABLE "vpn_accounts" ADD COLUMN "server_state" text;--> statement-breakpoint
ALTER TABLE "vpn_accounts" ADD COLUMN "server_state_reason" text;--> statement-breakpoint
ALTER TABLE "vpn_accounts" ADD COLUMN "server_state_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vpn_accounts" ADD COLUMN "server_state_until" timestamp with time zone;