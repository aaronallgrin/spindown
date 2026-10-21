/**
 * The group's Supabase project, built into the app so every phone syncs on its own:
 * no invite link, nothing to set up, and nothing lost when a phone clears its storage.
 * The anon key is meant to be public (it's in every page load anyway).
 */
export const GROUP_CLOUD: { url: string; key: string } | null = null;
