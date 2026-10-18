/**
 * Cookie holding "pinned" while the admin sidebar is kept open. The panel layout reads it so the
 * first paint already matches; kept outside the "use client" sidebar so the server gets the string.
 */
export const SIDEBAR_COOKIE = "admin-sidebar";
