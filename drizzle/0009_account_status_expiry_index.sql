-- Account check: the expiry job looks up removed accounts by status and expiry date. No enum literal
-- here, so it is safe in the same migration transaction as 0006 (which added the 'removed' value).
CREATE INDEX "vpn_accounts_status_expires_idx" ON "vpn_accounts" USING btree ("status","expires_at");