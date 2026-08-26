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
  const [dark, middle, light, highlight] = colors.map(
    ([red, green, blue]) => `rgb(${red} ${green} ${blue})`,
  );
  return `radial-gradient(circle at 72% 18%, ${highlight} 0%, transparent 43%), radial-gradient(circle at 22% 82%, ${light} 0%, transparent 48%), linear-gradient(135deg, ${dark}, ${middle})`;
}

const WELCOME_FALLBACK =
  'radial-gradient(ellipse at 74% 16%, rgb(212 246 255), rgb(111 196 221) 24%, transparent 52%), radial-gradient(ellipse at 42% 92%, rgb(71 220 232), rgb(16 128 157) 31%, transparent 56%), radial-gradient(ellipse at 4% 12%, rgb(0 4 7) 0%, rgb(0 16 24) 38%, transparent 61%), radial-gradient(ellipse at 94% 98%, rgb(0 4 7) 0%, rgb(0 18 28) 41%, transparent 64%), linear-gradient(110deg, rgb(0 8 13), rgb(23 119 151) 44%, rgb(4 42 61) 100%)';

/** Home's mesh field plus the four exact palettes approved for member identity. */
export const MESH_DRIFT_PALETTES = [
  {
    colors: [
      0.012, 0.11, 0.149, 0.106, 0.424, 0.659, 0.353, 0.824, 0.957, 0.918, 0.976,
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    fallback: WELCOME_FALLBACK,
  },
  ...([
    [
      [0, 18, 25],
      [0, 95, 115],
      [148, 210, 189],
      [233, 216, 166],
    ],
    [
      [16, 16, 16],
      [245, 245, 245],
      [176, 176, 176],
      [58, 58, 58],
    ],
    [
      [3, 18, 14],
      [14, 124, 90],
      [124, 229, 119],
      [244, 255, 199],
    ],
    [
      [16, 0, 43],
      [127, 0, 255],
      [51, 174, 185],
      [9, 32, 244],
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
