/**
 * Category Slug Canonicalization & Alias Mapping
 * Ensures all legacy links, plural forms, and promotional URLs seamlessly resolve
 * to real categories in the MySQL database.
 */

export const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  "custom-keychains": "keychain",
  "custom-keychain": "keychain",
  "keychains": "keychain",
  "spiritual-idols": "devotional",
  "spiritual-idol": "devotional",
  "spiritual": "devotional",
  "idols": "devotional",
  "articulated-toys": "curio",
  "articulated": "curio",
  "toys": "curio",
  "curios": "curio",
  "desk-organizers": "desktop-accessory",
  "desk-organizer": "desktop-accessory",
  "desktop-accessories": "desktop-accessory",
  "desk": "desktop-accessory",
  "lithophane-lamps": "night-lamp",
  "lithophane-lamp": "night-lamp",
  "night-lamps": "night-lamp",
  "lamps": "night-lamp",
  "lamp": "night-lamp",
  "lithophanes": "lithophane-panel",
  "lithophane-panels": "lithophane-panel",
  "litho-keychains": "litho-keychain",
  "teddy-bears": "teddy-bear",
  "name-plates": "name-plate",
  "photo-figurines": "photo-figurine",
  "miniatures-decor": "curio",
  "miniatures": "curio",
  "decor": "curio",
  "more-gifts": "other",
  "gifts": "other",
  "wall-arts": "wall-art",
};

/**
 * Normalizes any category slug or alias into its canonical database slug.
 */
export function normalizeCategorySlug(slug?: string | null): string {
  if (!slug) return "";
  const raw = slug.trim().toLowerCase();
  const withHyphen = raw.replace(/_/g, "-");
  return CATEGORY_SLUG_ALIASES[withHyphen] || CATEGORY_SLUG_ALIASES[raw] || withHyphen;
}
