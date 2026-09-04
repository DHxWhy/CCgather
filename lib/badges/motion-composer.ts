import type { Badge } from "@/lib/constants/badges";

export const MOTION_FPS = 30;
export const MOTION_INTRO_END = 24;
export const MOTION_OUT_POINT = 114;
export const MOTION_SIZE = 512;
export const MOTION_ASSET_ID = "pin";
export const MOTION_IMAGE_DIR = "/badges/v1/";

const CENTER = MOTION_SIZE / 2;
const EASE_OUT = { i: { x: [0.2], y: [1] }, o: { x: [0.4], y: [0] } };
const EASE_IN_OUT = { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } };
const CORAL = [0.855, 0.467, 0.337] as const;
const IVORY = [0.961, 0.937, 0.902] as const;
const GOLD = [0.976, 0.784, 0.325] as const;
const VIOLET = [0.545, 0.361, 0.965] as const;

type Rgb = readonly [number, number, number];
type Keyframe = { t: number; s: number[]; i?: unknown; o?: unknown };
type Animated = { a: 0; k: number | number[] } | { a: 1; k: Keyframe[] };

const constant = (k: number | number[]): Animated => ({ a: 0, k });

function animated(frames: Array<[t: number, v: number[]]>, ease = EASE_IN_OUT): Animated {
  return {
    a: 1,
    k: frames.map(([t, s], idx) => (idx === frames.length - 1 ? { t, s } : { t, s, ...ease })),
  };
}

function transform(opts: { p?: Animated; s?: Animated; o?: Animated; r?: Animated; a?: number[] }) {
  return {
    p: opts.p ?? constant([CENTER, CENTER]),
    a: constant(opts.a ?? [0, 0]),
    s: opts.s ?? constant([100, 100]),
    r: opts.r ?? constant(0),
    o: opts.o ?? constant(100),
  };
}

const fill = (c: Rgb, opacity = 100) => ({
  ty: "fl",
  c: constant([...c, 1]),
  o: constant(opacity),
});

function radialFill(c: Rgb, radius: number, opacity = 100) {
  return {
    ty: "gf",
    t: 2,
    r: 1,
    o: constant(opacity),
    s: constant([0, 0]),
    e: constant([radius, 0]),
    g: { p: 2, k: constant([0, ...c, 1, ...c, 0, 1, 1, 0]) },
  };
}

const groupTransform = () => ({
  ty: "tr",
  p: constant([0, 0]),
  a: constant([0, 0]),
  s: constant([100, 100]),
  r: constant(0),
  o: constant(100),
});

const ellipse = (w: number, h: number) => ({ ty: "el", p: constant([0, 0]), s: constant([w, h]) });
const rect = (w: number, h: number, r = 2) => ({
  ty: "rc",
  p: constant([0, 0]),
  s: constant([w, h]),
  r: constant(r),
});
const star = (outer: number, inner: number) => ({
  ty: "sr",
  sy: 1,
  pt: constant(4),
  p: constant([0, 0]),
  r: constant(0),
  ir: constant(inner),
  or: constant(outer),
  is: constant(0),
  os: constant(0),
});

interface LayerBase {
  nm: string;
  ip?: number;
  op?: number;
  tt?: number;
  td?: number;
}

function shapeLayer(base: LayerBase, ks: ReturnType<typeof transform>, items: unknown[]) {
  return {
    ddd: 0,
    ty: 4,
    nm: base.nm,
    sr: 1,
    st: 0,
    ip: base.ip ?? 0,
    op: base.op ?? MOTION_OUT_POINT,
    ...(base.tt !== undefined ? { tt: base.tt } : {}),
    ks,
    shapes: [{ ty: "gr", nm: base.nm, it: [...items, groupTransform()] }],
  };
}

function imageLayer(base: LayerBase, ks: ReturnType<typeof transform>) {
  return {
    ddd: 0,
    ty: 2,
    nm: base.nm,
    refId: MOTION_ASSET_ID,
    sr: 1,
    st: 0,
    ip: 0,
    op: MOTION_OUT_POINT,
    ...(base.td !== undefined ? { td: base.td } : {}),
    ks,
  };
}

const popIn = () =>
  animated(
    [
      [0, [60, 60]],
      [14, [108, 108]],
      [MOTION_INTRO_END, [100, 100]],
    ],
    EASE_OUT
  );

const fadeIn = () =>
  animated(
    [
      [0, [0]],
      [10, [100]],
    ],
    EASE_OUT
  );

function pinLayer(float: boolean) {
  const p = float
    ? animated([
        [MOTION_INTRO_END, [CENTER, CENTER]],
        [69, [CENTER, CENTER - 8]],
        [MOTION_OUT_POINT, [CENTER, CENTER]],
      ])
    : undefined;
  return imageLayer({ nm: "pin" }, transform({ p, s: popIn(), o: fadeIn(), a: [CENTER, CENTER] }));
}

function sheenLayers(color: Rgb) {
  const matte = imageLayer(
    { nm: "pin-matte", td: 1 },
    transform({ s: popIn(), a: [CENTER, CENTER] })
  );
  const sheen = shapeLayer(
    { nm: "sheen", tt: 1, ip: MOTION_INTRO_END },
    transform({
      p: animated([
        [MOTION_INTRO_END, [-120, CENTER]],
        [64, [MOTION_SIZE + 120, CENTER]],
        [MOTION_OUT_POINT, [MOTION_SIZE + 120, CENTER]],
      ]),
      r: constant(-25),
    }),
    [rect(70, 900, 0), fill(color, 42)]
  );
  return [matte, sheen];
}

function glowLayer() {
  return shapeLayer(
    { nm: "glow" },
    transform({
      s: popIn(),
      o: animated([
        [0, [0]],
        [MOTION_INTRO_END, [35]],
        [69, [75]],
        [MOTION_OUT_POINT, [35]],
      ]),
    }),
    [ellipse(560, 560), radialFill(VIOLET, 280, 100)]
  );
}

function gemGlintLayer() {
  return shapeLayer(
    { nm: "gem-glint", ip: MOTION_INTRO_END },
    transform({
      p: constant([CENTER, MOTION_SIZE - 70]),
      s: animated([
        [MOTION_INTRO_END, [50, 50]],
        [50, [130, 130]],
        [78, [50, 50]],
        [104, [130, 130]],
        [MOTION_OUT_POINT, [50, 50]],
      ]),
      o: animated([
        [MOTION_INTRO_END, [20]],
        [50, [100]],
        [78, [20]],
        [104, [100]],
        [MOTION_OUT_POINT, [20]],
      ]),
    }),
    [star(30, 8), fill(IVORY, 95)]
  );
}

function sparkLayers() {
  const spots: Array<[x: number, y: number, delay: number]> = [
    [68, 140, 0],
    [446, 170, 14],
    [244, 26, 28],
  ];
  return spots.map(([x, y, delay], idx) => {
    const t0 = MOTION_INTRO_END + delay;
    const cycle = 44;
    const frames: Array<[number, number[]]> = [[t0, [0]]];
    for (let t = t0; t + cycle <= MOTION_OUT_POINT; t += cycle) {
      frames.push([t + cycle / 2, [100]], [t + cycle, [0]]);
    }
    const lastFrame = frames.at(-1);
    if (lastFrame && lastFrame[0] < MOTION_OUT_POINT) frames.push([MOTION_OUT_POINT, [0]]);
    return shapeLayer(
      { nm: `spark-${idx + 1}`, ip: t0 },
      transform({ p: constant([x, y]), o: animated(frames) }),
      [star(22, 5), fill(GOLD, 100)]
    );
  });
}

function confettiLayers() {
  const colors: Rgb[] = [CORAL, IVORY, GOLD, VIOLET, CORAL, IVORY, GOLD, CORAL];
  return colors.map((c, idx) => {
    const angle = (Math.PI * 2 * idx) / colors.length - Math.PI / 2;
    const dist = 250 + (idx % 2) * 40;
    const end = [CENTER + Math.cos(angle) * dist, CENTER + Math.sin(angle) * dist];
    return shapeLayer(
      { nm: `confetti-${idx + 1}`, op: MOTION_INTRO_END + 6 },
      transform({
        p: animated(
          [
            [2, [CENTER, CENTER]],
            [MOTION_INTRO_END + 6, end],
          ],
          EASE_OUT
        ),
        r: animated(
          [
            [2, [0]],
            [MOTION_INTRO_END + 6, [200 + idx * 40]],
          ],
          EASE_OUT
        ),
        o: animated([
          [2, [100]],
          [MOTION_INTRO_END - 2, [100]],
          [MOTION_INTRO_END + 6, [0]],
        ]),
        s: constant([100, 100]),
      }),
      [rect(14, 26), fill(c, 100)]
    );
  });
}

function layersFor(rarity: Badge["rarity"]) {
  switch (rarity) {
    case "common":
      return [pinLayer(false)];
    case "rare":
      return [...sheenLayers(IVORY), pinLayer(false)];
    case "epic":
      return [gemGlintLayer(), pinLayer(false), glowLayer()];
    case "legendary":
      return [...sparkLayers(), ...sheenLayers(GOLD), ...confettiLayers(), pinLayer(true)];
  }
}

export function composeBadgeMotion(badgeId: string, rarity: Badge["rarity"]) {
  return {
    v: "5.12.2",
    nm: `ccgather-badge-${badgeId}`,
    fr: MOTION_FPS,
    ip: 0,
    op: MOTION_OUT_POINT,
    w: MOTION_SIZE,
    h: MOTION_SIZE,
    ddd: 0,
    markers: [
      { cm: "intro", tm: 0, dr: MOTION_INTRO_END },
      { cm: "idle", tm: MOTION_INTRO_END, dr: MOTION_OUT_POINT - MOTION_INTRO_END },
    ],
    assets: [
      {
        id: MOTION_ASSET_ID,
        w: MOTION_SIZE,
        h: MOTION_SIZE,
        u: MOTION_IMAGE_DIR,
        p: `${badgeId}-${MOTION_SIZE}.webp`,
        e: 0,
      },
    ],
    layers: layersFor(rarity),
  };
}

export type BadgeMotionJson = ReturnType<typeof composeBadgeMotion>;
