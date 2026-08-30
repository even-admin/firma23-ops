export type MeshDriftPalette = 0 | 1 | 2 | 3 | 4;

type Rgb = readonly [number, number, number];

export interface MeshPaletteConfig {
  readonly colors: readonly number[];
  readonly fallback: string;
}

function packColors(colors: readonly Rgb[]): readonly number[] {
  const packed = colors.flatMap(([red, green, blue]) => [red / 255, green / 255, blue / 255]);
  return [...packed, ...Array.from({ length: (8 - colors.length) * 3 }, () => 0)];
}

function paletteFallback(colors: readonly Rgb[]): string {
  const [red, green, blue] = colors[1] ?? colors[0] ?? [26, 26, 26];
  return `rgb(${red} ${green} ${blue})`;
}

const WELCOME_FALLBACK =
  'rgb(26 26 26)';

/** Home's mesh field plus the four exact palettes approved for member identity. */
export const MESH_DRIFT_PALETTES = [
  {
    colors: [
      0.012, 0.012, 0.012, 0.11, 0.11, 0.11, 0.353, 0.353, 0.353, 0.918, 0.918,
      0.918, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    fallback: WELCOME_FALLBACK,
  },
  ...([
    [
      [8, 8, 8],
      [72, 72, 72],
      [168, 168, 168],
      [240, 240, 240],
    ],
    [
      [16, 16, 16],
      [245, 245, 245],
      [176, 176, 176],
      [58, 58, 58],
    ],
    [
      [14, 14, 14],
      [86, 86, 86],
      [178, 178, 178],
      [244, 244, 244],
    ],
    [
      [20, 20, 20],
      [96, 96, 96],
      [164, 164, 164],
      [232, 232, 232],
    ],
  ] as const).map((colors) => ({ colors: packColors(colors), fallback: paletteFallback(colors) })),
] as const satisfies readonly MeshPaletteConfig[];

export const MESH_DRIFT_PALETTE_COUNT = MESH_DRIFT_PALETTES.length;

export const MESH_DRIFT_FIELD = {
  sceneSpeed: -1.37,
  shape: [1.3, 0.56, 0.67, 0.19],
  surface: [2.02, 1.17, 0, 1],
  finish: [0, 0.15, 0.007, 0.1],
  transform: [5069, 2.72, 0.15, 0],
  space: [0.09, 0.15, 0, 0],
  cursor: [0, 2, 0.65, 0.46],
} as const;
