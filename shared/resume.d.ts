// Type declarations for the shared runtime module (shared/resume.js).
import type { DesignTokens, SectionKey, TemplateId } from './types/resume';

export const SECTION_KEYS: SectionKey[];
export const DEFAULT_SECTION_TITLES: Record<SectionKey, string>;
export const TEMPLATE_IDS: TemplateId[];
export const FONTS: DesignTokens['font'][];
export const FONT_SIZES: DesignTokens['fontSize'][];
export const SECTION_SPACINGS: DesignTokens['sectionSpacing'][];
export const HEADER_STYLES: DesignTokens['headerStyle'][];
export const SECTION_RULES: DesignTokens['sectionRule'][];
export const BULLET_CHARS: DesignTokens['bulletChar'][];
export const DATE_FORMATS: DesignTokens['dateFormat'][];
export const LINK_STYLES: DesignTokens['links'][];
export const DEFAULT_DESIGN: DesignTokens;
export function validateDesign(design: unknown): DesignTokens;
export function sectionTitle(key: SectionKey, design: DesignTokens): string;
