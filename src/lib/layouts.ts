// 10+ layouts with random variations. Each returns a list of fabric-ready
// element descriptors that Editor consumes to build a canvas.

export type ElementDesc =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: string; opacity?: number; rx?: number }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { kind: "image"; x: number; y: number; w: number; h: number; url: string; opacity?: number }
  | { kind: "text"; x: number; y: number; w: number; text: string; size: number; color: string; align: "left"|"center"|"right"; weight?: number; italic?: boolean; shadow?: string; font?: string };

export interface LayoutInput {
  title: string;
  body?: string;
  imageUrl?: string;
  palette: string[]; // [bg, primary, accent, text]
  width: number;
  height: number;
  fonts: { display: string; body: string };
}

const rnd = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const between = (a: number, b: number) => a + Math.random() * (b - a);

export const LAYOUT_IDS = [
  "top-text", "center-text", "bottom-text", "side-text",
  "text-over-image", "hero-image", "big-text-small-image",
  "split", "geometric-bg", "framed", "diagonal", "quote-card",
] as const;

export type LayoutId = typeof LAYOUT_IDS[number];

export function pickLayout(): LayoutId {
  return rnd([...LAYOUT_IDS]);
}

export function buildLayout(id: LayoutId, input: LayoutInput): ElementDesc[] {
  const { title, body, imageUrl, palette, width: W, height: H, fonts } = input;
  const [bg, primary, accent, text] = palette;
  const els: ElementDesc[] = [];

  // background
  els.push({ kind: "rect", x: 0, y: 0, w: W, h: H, fill: bg });

  const P = Math.round(W * 0.06); // padding

  const bigTitle = Math.round(W * between(0.09, 0.13));
  const medTitle = Math.round(W * between(0.06, 0.085));
  const bodySize = Math.round(W * between(0.03, 0.042));

  const titleAlign = rnd(["left","center","right"] as const);

  switch (id) {
    case "top-text": {
      if (imageUrl) els.push({ kind: "image", x: 0, y: H*0.45, w: W, h: H*0.55, url: imageUrl });
      els.push({ kind: "text", x: P, y: P, w: W-2*P, text: title, size: medTitle, color: text, align: titleAlign, weight: 700, font: fonts.display });
      if (body) els.push({ kind: "text", x: P, y: P + medTitle + 20, w: W-2*P, text: body, size: bodySize, color: text, align: titleAlign, font: fonts.body });
      break;
    }
    case "center-text": {
      if (imageUrl) els.push({ kind: "image", x: 0, y: 0, w: W, h: H, url: imageUrl, opacity: 0.35 });
      els.push({ kind: "text", x: P, y: H/2 - medTitle, w: W-2*P, text: title, size: bigTitle, color: text, align: "center", weight: 700, font: fonts.display });
      if (body) els.push({ kind: "text", x: P, y: H/2 + medTitle*0.6, w: W-2*P, text: body, size: bodySize, color: text, align: "center", font: fonts.body });
      break;
    }
    case "bottom-text": {
      if (imageUrl) els.push({ kind: "image", x: 0, y: 0, w: W, h: H*0.6, url: imageUrl });
      els.push({ kind: "rect", x: 0, y: H*0.55, w: W, h: H*0.45, fill: bg, opacity: 0.95 });
      els.push({ kind: "text", x: P, y: H*0.62, w: W-2*P, text: title, size: medTitle, color: text, align: titleAlign, weight: 700, font: fonts.display });
      if (body) els.push({ kind: "text", x: P, y: H*0.62 + medTitle + 20, w: W-2*P, text: body, size: bodySize, color: text, align: titleAlign, font: fonts.body });
      break;
    }
    case "side-text": {
      const leftText = Math.random() > 0.5;
      const halfW = W*0.5;
      if (imageUrl) els.push({ kind: "image", x: leftText ? halfW : 0, y: 0, w: halfW, h: H, url: imageUrl });
      els.push({ kind: "text", x: (leftText?0:halfW)+P, y: H*0.3, w: halfW-2*P, text: title, size: medTitle, color: text, align: "left", weight: 700, font: fonts.display });
      if (body) els.push({ kind: "text", x: (leftText?0:halfW)+P, y: H*0.3+medTitle+20, w: halfW-2*P, text: body, size: bodySize, color: text, align: "left", font: fonts.body });
      break;
    }
    case "text-over-image": {
      if (imageUrl) els.push({ kind: "image", x: 0, y: 0, w: W, h: H, url: imageUrl });
      els.push({ kind: "rect", x: 0, y: 0, w: W, h: H, fill: "#000000", opacity: 0.45 });
      els.push({ kind: "text", x: P, y: H*between(0.2, 0.6), w: W-2*P, text: title, size: bigTitle, color: "#ffffff", align: titleAlign, weight: 700, shadow: "rgba(0,0,0,0.6) 0 4 20", font: fonts.display });
      break;
    }
    case "hero-image": {
      if (imageUrl) els.push({ kind: "image", x: W*0.1, y: H*0.08, w: W*0.8, h: H*0.6, url: imageUrl });
      els.push({ kind: "text", x: P, y: H*0.72, w: W-2*P, text: title, size: medTitle, color: text, align: "center", weight: 700, font: fonts.display });
      if (body) els.push({ kind: "text", x: P, y: H*0.72+medTitle+16, w: W-2*P, text: body, size: bodySize, color: text, align: "center", font: fonts.body });
      break;
    }
    case "big-text-small-image": {
      els.push({ kind: "text", x: P, y: P, w: W-2*P, text: title, size: bigTitle*1.1, color: text, align: "left", weight: 700, font: fonts.display });
      if (imageUrl) els.push({ kind: "image", x: W*0.55, y: H*0.6, w: W*0.4, h: W*0.4, url: imageUrl });
      if (body) els.push({ kind: "text", x: P, y: H*0.65, w: W*0.5, text: body, size: bodySize, color: text, align: "left", font: fonts.body });
      break;
    }
    case "split": {
      els.push({ kind: "rect", x: 0, y: 0, w: W/2, h: H, fill: primary });
      els.push({ kind: "rect", x: W/2, y: 0, w: W/2, h: H, fill: bg });
      if (imageUrl) els.push({ kind: "image", x: 0, y: 0, w: W/2, h: H, url: imageUrl, opacity: 0.9 });
      els.push({ kind: "text", x: W/2+P, y: H/2 - medTitle, w: W/2-2*P, text: title, size: medTitle, color: text, align: "left", weight: 700, font: fonts.display });
      if (body) els.push({ kind: "text", x: W/2+P, y: H/2+medTitle*0.5, w: W/2-2*P, text: body, size: bodySize, color: text, align: "left", font: fonts.body });
      break;
    }
    case "geometric-bg": {
      els.push({ kind: "circle", cx: W*between(0.1, 0.9), cy: H*between(0.1, 0.5), r: W*between(0.2, 0.35), fill: primary, opacity: 0.7 });
      els.push({ kind: "rect", x: W*between(0, 0.4), y: H*between(0.4, 0.7), w: W*0.6, h: W*0.6, fill: accent, opacity: 0.5, rx: 24 });
      if (imageUrl) els.push({ kind: "image", x: W*0.25, y: H*0.15, w: W*0.5, h: W*0.5, url: imageUrl });
      els.push({ kind: "text", x: P, y: H*0.7, w: W-2*P, text: title, size: medTitle, color: text, align: "center", weight: 700, font: fonts.display });
      break;
    }
    case "framed": {
      const b = W*0.04;
      els.push({ kind: "rect", x: b, y: b, w: W-2*b, h: H-2*b, fill: primary, opacity: 0.15, rx: 12 });
      if (imageUrl) els.push({ kind: "image", x: W*0.15, y: H*0.15, w: W*0.7, h: H*0.4, url: imageUrl });
      els.push({ kind: "text", x: P, y: H*0.6, w: W-2*P, text: title, size: medTitle, color: text, align: "center", weight: 700, font: fonts.display });
      if (body) els.push({ kind: "text", x: P, y: H*0.6+medTitle+16, w: W-2*P, text: body, size: bodySize, color: text, align: "center", font: fonts.body });
      break;
    }
    case "diagonal": {
      if (imageUrl) els.push({ kind: "image", x: 0, y: 0, w: W, h: H, url: imageUrl, opacity: 0.55 });
      els.push({ kind: "circle", cx: W*1.1, cy: H*1.1, r: W*0.9, fill: accent, opacity: 0.35 });
      els.push({ kind: "text", x: P, y: H*0.35, w: W-2*P, text: title, size: bigTitle, color: text, align: "left", weight: 700, font: fonts.display });
      if (body) els.push({ kind: "text", x: P, y: H*0.35 + bigTitle + 20, w: W-2*P, text: body, size: bodySize, color: text, align: "left", font: fonts.body });
      break;
    }
    case "quote-card": {
      els.push({ kind: "rect", x: W*0.08, y: H*0.15, w: W*0.84, h: H*0.7, fill: primary, opacity: 0.9, rx: 24 });
      els.push({ kind: "text", x: W*0.12, y: H*0.25, w: W*0.76, text: "“", size: bigTitle*1.5, color: text, align: "left", weight: 700, font: fonts.display });
      els.push({ kind: "text", x: W*0.12, y: H*0.35, w: W*0.76, text: title, size: medTitle, color: text, align: "left", weight: 600, italic: true, font: fonts.display });
      if (body) els.push({ kind: "text", x: W*0.12, y: H*0.7, w: W*0.76, text: body, size: bodySize, color: text, align: "right", font: fonts.body });
      break;
    }
  }
  return els;
}

export const PALETTES: string[][] = [
  ["#0f0f1a", "#a855f7", "#22d3ee", "#f5f5ff"],
  ["#1a0f14", "#f97316", "#fbbf24", "#fff7ed"],
  ["#0b1220", "#3b82f6", "#22d3ee", "#e6f0ff"],
  ["#0f172a", "#10b981", "#facc15", "#ecfeff"],
  ["#1c0e1a", "#ec4899", "#8b5cf6", "#fdf4ff"],
  ["#111", "#e5e7eb", "#a3a3a3", "#111"],
  ["#f5f5f0", "#111", "#ef4444", "#111"],
  ["#0a0a0a", "#facc15", "#f97316", "#fef3c7"],
];

export const FONT_PAIRS = [
  { display: "Space Grotesk", body: "Inter" },
  { display: "Playfair Display", body: "Inter" },
  { display: "Bebas Neue", body: "Inter" },
  { display: "Archivo Black", body: "Inter" },
  { display: "Syne", body: "Inter" },
  { display: "DM Serif Display", body: "Inter" },
];

export function randomStyle() {
  return { palette: rnd(PALETTES), fonts: rnd(FONT_PAIRS), layout: pickLayout() };
}
