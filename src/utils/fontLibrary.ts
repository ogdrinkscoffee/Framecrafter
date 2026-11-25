export type FontCategory = 'Sans & UI' | 'Editorial Serif' | 'Display & Bold' | 'Monospace' | 'System';

export interface StudioFontOption {
  id: string;
  label: string;
  category: FontCategory;
  cssValue: string;
  googleFamily?: string;
}

export const STUDIO_FONT_CATALOG: StudioFontOption[] = [
  // Sans & UI
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans',
    category: 'Sans & UI',
    cssValue: '"Plus Jakarta Sans", sans-serif',
    googleFamily: 'Plus+Jakarta+Sans:wght@400;500;600;700',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    category: 'Sans & UI',
    cssValue: '"DM Sans", sans-serif',
    googleFamily: 'DM+Sans:wght@400;500;600;700',
  },
  {
    id: 'outfit',
    label: 'Outfit',
    category: 'Sans & UI',
    cssValue: '"Outfit", sans-serif',
    googleFamily: 'Outfit:wght@400;500;600;700',
  },
  {
    id: 'manrope',
    label: 'Manrope',
    category: 'Sans & UI',
    cssValue: '"Manrope", sans-serif',
    googleFamily: 'Manrope:wght@400;500;600;700',
  },
  {
    id: 'bricolage',
    label: 'Bricolage Grotesque',
    category: 'Sans & UI',
    cssValue: '"Bricolage Grotesque", sans-serif',
    googleFamily: 'Bricolage+Grotesque:wght@400;500;600;700',
  },
  {
    id: 'poppins',
    label: 'Poppins',
    category: 'Sans & UI',
    cssValue: '"Poppins", sans-serif',
    googleFamily: 'Poppins:wght@400;500;600;700',
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    category: 'Sans & UI',
    cssValue: '"Montserrat", sans-serif',
    googleFamily: 'Montserrat:wght@400;500;600;700',
  },
  {
    id: 'work-sans',
    label: 'Work Sans',
    category: 'Sans & UI',
    cssValue: '"Work Sans", sans-serif',
    googleFamily: 'Work+Sans:wght@400;500;600;700',
  },
  {
    id: 'public-sans',
    label: 'Public Sans',
    category: 'Sans & UI',
    cssValue: '"Public Sans", sans-serif',
    googleFamily: 'Public+Sans:wght@400;500;600;700',
  },
  {
    id: 'urbanist',
    label: 'Urbanist',
    category: 'Sans & UI',
    cssValue: '"Urbanist", sans-serif',
    googleFamily: 'Urbanist:wght@400;500;600;700',
  },

  // Editorial Serif
  {
    id: 'playfair',
    label: 'Playfair Display',
    category: 'Editorial Serif',
    cssValue: '"Playfair Display", Georgia, serif',
    googleFamily: 'Playfair+Display:ital,wght@0,500;0,600;0,700;1,500',
  },
  {
    id: 'fraunces',
    label: 'Fraunces',
    category: 'Editorial Serif',
    cssValue: '"Fraunces", Georgia, serif',
    googleFamily: 'Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700',
  },
  {
    id: 'cormorant',
    label: 'Cormorant Garamond',
    category: 'Editorial Serif',
    cssValue: '"Cormorant Garamond", Georgia, serif',
    googleFamily: 'Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500',
  },
  {
    id: 'lora',
    label: 'Lora',
    category: 'Editorial Serif',
    cssValue: '"Lora", Georgia, serif',
    googleFamily: 'Lora:ital,wght@0,400;0,600;1,400',
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    category: 'Editorial Serif',
    cssValue: '"Merriweather", Georgia, serif',
    googleFamily: 'Merriweather:wght@400;700',
  },
  {
    id: 'source-serif',
    label: 'Source Serif 4',
    category: 'Editorial Serif',
    cssValue: '"Source Serif 4", Georgia, serif',
    googleFamily: 'Source+Serif+4:wght@400;600;700',
  },

  // Display & Bold
  {
    id: 'syne',
    label: 'Syne',
    category: 'Display & Bold',
    cssValue: '"Syne", sans-serif',
    googleFamily: 'Syne:wght@500;600;700',
  },
  {
    id: 'oswald',
    label: 'Oswald',
    category: 'Display & Bold',
    cssValue: '"Oswald", sans-serif',
    googleFamily: 'Oswald:wght@500;600;700',
  },
  {
    id: 'bebas-neue',
    label: 'Bebas Neue',
    category: 'Display & Bold',
    cssValue: '"Bebas Neue", sans-serif',
    googleFamily: 'Bebas+Neue',
  },
  {
    id: 'archivo',
    label: 'Archivo',
    category: 'Display & Bold',
    cssValue: '"Archivo", sans-serif',
    googleFamily: 'Archivo:wght@500;600;700',
  },
  {
    id: 'righteous',
    label: 'Righteous',
    category: 'Display & Bold',
    cssValue: '"Righteous", sans-serif',
    googleFamily: 'Righteous',
  },

  // Monospace
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    category: 'Monospace',
    cssValue: '"JetBrains Mono", monospace',
    googleFamily: 'JetBrains+Mono:wght@400;500;600',
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    category: 'Monospace',
    cssValue: '"Fira Code", monospace',
    googleFamily: 'Fira+Code:wght@400;500;600',
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    category: 'Monospace',
    cssValue: '"IBM Plex Mono", monospace',
    googleFamily: 'IBM+Plex+Mono:wght@400;500;600',
  },
  {
    id: 'space-mono',
    label: 'Space Mono',
    category: 'Monospace',
    cssValue: '"Space Mono", monospace',
    googleFamily: 'Space+Mono:wght@400;700',
  },

  // System Classic
  {
    id: 'segoe-ui',
    label: 'Segoe UI',
    category: 'System',
    cssValue: '"Segoe UI", Tahoma, sans-serif',
  },
  {
    id: 'arial',
    label: 'Arial',
    category: 'System',
    cssValue: 'Arial, Helvetica, sans-serif',
  },
  {
    id: 'georgia',
    label: 'Georgia',
    category: 'System',
    cssValue: 'Georgia, serif',
  },
  {
    id: 'times-new-roman',
    label: 'Times New Roman',
    category: 'System',
    cssValue: '"Times New Roman", serif',
  },
];

export const FONT_CATEGORIES: FontCategory[] = [
  'Sans & UI',
  'Editorial Serif',
  'Display & Bold',
  'Monospace',
  'System',
];

export function matchStudioFontOption(fontFamilyValue: string | undefined | null): StudioFontOption | null {
  if (!fontFamilyValue) return null;
  const normalized = fontFamilyValue.toLowerCase();
  for (const font of STUDIO_FONT_CATALOG) {
    if (
      font.cssValue.toLowerCase() === normalized ||
      normalized.includes(font.label.toLowerCase())
    ) {
      return font;
    }
  }
  return null;
}

export function buildGoogleFontsHref(families: string[]): string | null {
  const unique = Array.from(new Set(families.filter(Boolean))).sort();
  if (unique.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${unique.map((f) => `family=${f}`).join('&')}&display=swap`;
}

export function collectUsedGoogleFonts(sources: string[]): string[] {
  const combined = sources.join('\n').toLowerCase();
  const families: string[] = [];
  for (const font of STUDIO_FONT_CATALOG) {
    if (!font.googleFamily) continue;
    if (combined.includes(font.label.toLowerCase())) {
      families.push(font.googleFamily);
    }
  }
  return families;
}

export function ensureGoogleFontInHtml(html: string, fontFamilyCss: string): string {
  const matched = matchStudioFontOption(fontFamilyCss);
  if (!matched?.googleFamily) return html;
  const href = buildGoogleFontsHref([matched.googleFamily]);
  if (!href) return html;
  if (html.includes(matched.googleFamily) || html.includes(`family=${matched.googleFamily.split(':')[0]}`)) {
    return html;
  }
  const tag = `<link rel="stylesheet" href="${href}" data-ve-font="${matched.id}" />`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${tag}\n  </head>`);
  }
  return `${tag}\n${html}`;
}
