import { describe, expect, it } from "vitest";
import { initialValues, validateField } from "@/components/public/account/form-validation";
import { effectiveDefaultDuration, openDurations } from "@/lib/public/durations";
import { DEFAULT_SITE_SETTINGS, siteSettingsSchema } from "@/lib/site-settings";
import type { PublicFormField, PublicProtocolDetail } from "@/lib/public/types";

const DURATION: PublicFormField = {
  key: "duration",
  label: "Duration",
  type: "duration",
  required: true,
  placeholder: null,
  helpText: null,
  options: [],
  validation: {},
  defaultValue: null,
};

function ssh(lockedDurations: number[], defaultDurationDays = 7): PublicProtocolDetail {
  return {
    slug: "ssh",
    name: "SSH",
    description: "",
    icon: "ssh",
    category: "ssh",
    serverCount: 1,
    availableCount: 1,
    countries: [],
    durationOptions: [3, 7, 14, 30],
    lockedDurations,
    defaultDurationDays,
    href: "/ssh",
    fields: [DURATION],
  };
}

describe("locked durations", () => {
  it("lists the open durations, ascending and once each", () => {
    expect(openDurations([30, 3, 7, 14], [7, 14, 30])).toEqual([3]);
    expect(openDurations([7, 3, 3], [])).toEqual([3, 7]);
    expect(openDurations([7, 14], [7, 14])).toEqual([]);
  });

  it("starts on the default unless it is locked, then on the shortest open duration", () => {
    expect(effectiveDefaultDuration([3, 7, 14, 30], 7, [])).toBe(7);
    expect(effectiveDefaultDuration([3, 7, 14, 30], 7, [7, 14, 30])).toBe(3);
    expect(effectiveDefaultDuration([3, 7, 14, 30], 14, [3, 14])).toBe(7);
    expect(effectiveDefaultDuration([7, 14], 7, [7, 14])).toBeUndefined();
  });

  it("the create form never preselects or accepts a locked duration", () => {
    expect(initialValues(ssh([7, 14, 30])).duration).toBe("3");
    expect(initialValues(ssh([])).duration).toBe("7");
    expect(initialValues(ssh([3, 7, 14, 30])).duration).toBe("");
    expect(validateField(DURATION, "3", ssh([7, 14, 30]))).toBeNull();
    expect(validateField(DURATION, "7", ssh([7, 14, 30]))).toMatch(/locked/);
    expect(validateField(DURATION, "5", ssh([7, 14, 30]))).not.toBeNull();
    expect(validateField(DURATION, "", ssh([3, 7, 14, 30]))).toMatch(/No duration is available/);
  });

  it("stores locked durations deduplicated and sorted, within 1 to 365 days; nothing is locked by default", () => {
    expect(DEFAULT_SITE_SETTINGS.lockedDurations).toEqual([]);
    expect(siteSettingsSchema.parse({ ...DEFAULT_SITE_SETTINGS, lockedDurations: [30, 7, 14, 7] }).lockedDurations).toEqual([7, 14, 30]);
    expect(siteSettingsSchema.safeParse({ ...DEFAULT_SITE_SETTINGS, lockedDurations: [0] }).success).toBe(false);
    expect(siteSettingsSchema.safeParse({ ...DEFAULT_SITE_SETTINGS, lockedDurations: [366] }).success).toBe(false);
    expect(siteSettingsSchema.safeParse({ ...DEFAULT_SITE_SETTINGS, lockedDurations: [1.5] }).success).toBe(false);
  });
});
