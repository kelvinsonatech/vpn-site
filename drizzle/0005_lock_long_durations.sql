-- Lock the 7, 14 and 30 day account durations on a site that already has saved settings; they can be
-- unlocked again in Admin → Settings → Durations. New installs start with every duration open.
-- Skipped when an enabled protocol offers nothing but those durations (it would be left with none).
UPDATE "site_settings"
SET "data" = jsonb_set("data", '{lockedDurations}', '[7, 14, 30]'::jsonb, true)
WHERE NOT ("data" ? 'lockedDurations')
  AND NOT EXISTS (SELECT 1 FROM "protocols" WHERE "enabled" AND "duration_options" <@ ARRAY[7, 14, 30]);
