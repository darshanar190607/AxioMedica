// ─── RehabStep AI Design System ───────────────────────────────────────────────
// Reference palette: sage green background, mint cards, yellow/orange accents,
// off-white content areas, dark charcoal text.

export const COLORS = {
  // Backgrounds (60%)
  sage:        '#D4F3B7',   // main app background
  sageDark:    '#BDE8A0',   // darker sage for headers
  sageLight:   '#E2F7CC',   // lighter sage tint
  mint:        '#9DC3BB',   // secondary cards / exercise cards
  mintLight:   '#C2DAD6',   // very light mint tint

  // Content areas (30%)
  offWhite:    '#F3F4F5',   // main content cards
  cream:       '#FAECB9',   // subtle highlighted areas / progress sections
  white:       '#FFFFFF',   // pure white where needed

  // Accents (10%)
  yellow:      '#EFCA52',   // primary CTA buttons, highlights
  yellowLight: '#FDF5D0',   // yellow tint backgrounds
  orange:      '#EB9E29',   // secondary CTA, active states, icons
  orangeLight: '#FDF0D5',   // orange tint backgrounds

  // Text
  charcoal:    '#141717',   // main headings, important text
  mutedSage:   '#849B93',   // secondary text, placeholders
  lightGray:   '#CED9D8',   // dividers, subtle borders

  // Semantic
  safe:        '#4CAF50',
  caution:     '#FF9800',
  stop:        '#F44336',
};

export const RADIUS = {
  sm:   10,
  md:   16,
  lg:   22,
  xl:   30,
  full: 999,
};

export const SHADOW = {
  shadowColor:  '#0D2020',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.10,
  shadowRadius:  10,
  elevation: 4,
};

export const SHADOW_MD = {
  shadowColor:  '#0D2020',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.14,
  shadowRadius:  18,
  elevation: 8,
};
