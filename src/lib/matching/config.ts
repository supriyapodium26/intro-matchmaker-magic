// Tunable matching data: stage-proximity matrices, weights, thresholds, country tiers.
// Transcribed from the algorithm document — change values here, not in the engine.

import type { IcpKey } from "@/lib/intake-tree";

export const WEIGHTS = {
  stage: 40,
  businessType: 15,
  expertise: 15,
  lifeContext: 15,
  interests: 10,
  countries: 5,
} as const;

export type Dimension = keyof typeof WEIGHTS;

export const DIMENSION_LABELS: Record<Dimension, string> = {
  stage: "Stage proximity",
  businessType: "Business type",
  expertise: "Area of expertise",
  lifeContext: "Life context overlap",
  interests: "Interests overlap",
  countries: "Countries lived",
};

// Matrix[a][b] = proximity of stage answer a to stage answer b (0-indexed).
export const STAGE_MATRIX: Record<IcpKey, number[][]> = {
  career_crossroads: [
    [1.0, 0.2, 0.67, 0.4],
    [0.2, 1.0, 0.0, 0.0],
    [0.67, 0.0, 1.0, 0.9],
    [0.4, 0.0, 0.9, 1.0],
  ],
  side_hustler: [
    [1.0, 0.67, 0.33, 0.0],
    [0.67, 1.0, 0.67, 0.33],
    [0.33, 0.67, 1.0, 0.67],
    [0.0, 0.33, 0.67, 1.0],
  ],
  early_stage_founder: [
    [1.0, 0.5, 0.0],
    [0.5, 1.0, 0.5],
    [0.0, 0.5, 1.0],
  ],
  late_stage_founder: [
    [1.0, 0.6, 0.2, 0.1],
    [0.6, 1.0, 0.3, 0.2],
    [0.2, 0.3, 1.0, 0.5],
    [0.1, 0.2, 0.5, 1.0],
  ],
  portfolio_independent: [
    [1.0, 0.67, 0.33, 0.0],
    [0.67, 1.0, 0.67, 0.33],
    [0.33, 0.67, 1.0, 0.67],
    [0.0, 0.33, 0.67, 1.0],
  ],
  established_career: [
    [1.0, 0.0, 0.6, 0.5],
    [0.0, 1.0, 0.6, 0.0],
    [0.5, 0.5, 1.0, 0.3],
    [0.5, 0.0, 0.3, 1.0],
  ],
};

// Cultural-breadth tiers used only when there is no shared country.
export const COUNTRY_TIERS: Record<string, number> = {
  SG: 0.0,
  MY: 0.0,
  ID: 0.0,
  TH: 0.0,
  VN: 0.0,
  PH: 0.0,
  MM: 0.0,
  CN: 0.3,
  JP: 0.3,
  KR: 0.3,
  IN: 0.3,
  HK: 0.3,
  TW: 0.3,
  MO: 0.3,
  NP: 0.3,
  BT: 0.3,
  LK: 0.3,
  KZ: 0.3,
  AF: 0.3,
  AE: 0.6,
  BH: 0.6,
  JO: 0.6,
  LB: 0.6,
  OM: 0.6,
  QA: 0.6,
  SA: 0.6,
  IL: 0.6,
  TR: 0.6,
  RO: 0.6,
  HU: 0.6,
  BG: 0.6,
  RU: 0.6,
  CY: 0.6,
  GR: 0.6,
  BR: 0.6,
  MX: 0.6,
  CL: 0.6,
  US: 1.0,
  GB: 1.0,
  CA: 1.0,
  AU: 1.0,
  NZ: 1.0,
  IE: 1.0,
  FR: 1.0,
  DE: 1.0,
  NL: 1.0,
  CH: 1.0,
  ES: 1.0,
  IT: 1.0,
  PT: 1.0,
  AT: 1.0,
  BE: 1.0,
  DK: 1.0,
  SE: 1.0,
  NO: 1.0,
  FI: 1.0,
  IS: 1.0,
  LU: 1.0,
  ZA: 1.0,
  EG: 1.0,
  MA: 1.0,
  DZ: 1.0,
  AO: 1.0,
  GH: 1.0,
  NG: 1.0,
  ZM: 1.0,
  BW: 1.0,
};

// A breadth-only fallback can never outrank a real shared country.
export const COUNTRY_FALLBACK_CAP = 0.5;

export const THRESHOLDS: { min: number; band: string }[] = [
  { min: 75, band: "Strong match" },
  { min: 55, band: "Good match" },
  { min: 40, band: "Workable" },
  { min: 0, band: "Weak" },
];

export const FILTER_STEPS: { label: string; age: number; role: boolean; sizeBand: boolean; companyType: boolean }[] = [
  { label: "Age ±3 · role ±1 · same company type", age: 3, role: true, sizeBand: false, companyType: true },
  { label: "Age ±5 · role ±1 · company size ±1 band", age: 5, role: true, sizeBand: true, companyType: false },
  { label: "Age ±5 · role ±1", age: 5, role: true, sizeBand: false, companyType: false },
  { label: "Age ±5 only", age: 5, role: false, sizeBand: false, companyType: false },
];

export const PARENT_STATUSES = ["parent_young", "parent_school", "parent_teen", "parent_multi"];
export const CHILDFREE_STATUSES = ["childfree"];
