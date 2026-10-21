import { PageHeader } from "@/components/admin/page-header";
import type { TimeZoneOption } from "@/components/admin/timezone-picker";
import { AVATAR_STYLE_KEYS, AVATAR_STYLES } from "@/lib/avatar-styles";
import { requirePermission } from "@/server/auth/guards";
import { env } from "@/server/env";
import { durationUsage } from "@/server/protocols/service";
import { getSiteSettings } from "@/server/settings/service";
import { AVATAR_SAMPLE_SEEDS } from "./samples";
import { formatOffset, zoneOffsetMs } from "./schedule";
import { SettingsForm, type AvatarStyleOption } from "./settings-form";

export const metadata = { title: "Site settings" };

/** Every IANA zone the runtime knows, UTC first, with its current offset (computed here so SSR and hydration agree). */
function timeZoneOptions(current: string): TimeZoneOption[] {
  const now = Date.now();
  const ids = new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]);
  ids.add(current);
  return [...ids].map((id) => {
    let offset = "";
    try {
      offset = formatOffset(zoneOffsetMs(now, id));
    } catch {
      offset = "?";
    }
    return { id, offset };
  });
}

export default async function SettingsPage() {
  await requirePermission("settings:manage");
  const [settings, durations] = await Promise.all([getSiteSettings(), durationUsage()]);
  const styles: AvatarStyleOption[] = AVATAR_STYLE_KEYS.map((key) => ({
    key,
    label: AVATAR_STYLES[key].label,
    license: AVATAR_STYLES[key].license,
    previews: AVATAR_SAMPLE_SEEDS.map((_, i) => `/admin/settings/avatar-preview/${key}/${i}`),
  }));

  return (
    <>
      <PageHeader
        title="Site settings"
        description="Branding, announcements, quotas, durations, monitoring and avatars of the public website. Changes reach every page within a few seconds."
      />
      <SettingsForm
        initial={settings}
        zones={timeZoneOptions(settings.quota.timezone)}
        styles={styles}
        durations={durations}
        siteHost={new URL(env().APP_URL).host}
      />
    </>
  );
}
