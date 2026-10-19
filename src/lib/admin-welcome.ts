/**
 * Set by the server right after a successful admin sign-in (password, or password + two-factor);
 * the panel reads it once to play the welcome confetti, then deletes it. Not a secret.
 */
export const ADMIN_WELCOME_COOKIE = "vl_admin_welcome";
