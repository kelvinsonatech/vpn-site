CREATE TABLE "dns_sightings" (
	"ip" text NOT NULL,
	"hostname" text NOT NULL,
	"domain" text NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dns_sightings_ip_hostname_pk" PRIMARY KEY("ip","hostname")
);
--> statement-breakpoint
CREATE INDEX "dns_sightings_ip_last_seen_idx" ON "dns_sightings" USING btree ("ip","last_seen" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "dns_sightings_domain_idx" ON "dns_sightings" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "dns_sightings_last_seen_idx" ON "dns_sightings" USING btree ("last_seen");