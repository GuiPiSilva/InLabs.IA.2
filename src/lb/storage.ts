// Local project persistence (localStorage).
export type ProjectType = "carrossel" | "cartaz";

export interface Slide {
  id: string;
  // fabric.js JSON of the canvas
  canvas: unknown;
  // preview data-url (small)
  thumb?: string;
  width: number;
  height: number;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  createdAt: number;
  updatedAt: number;
  slides: Slide[];
  meta?: {
    theme?: string;
    style?: string;
    ratio?: string;
    reference?: string;
  };
}

const K = "inlabs.projects";

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(K) || "[]") as Project[];
  } catch { return []; }
}

export function saveProjects(list: Project[]) {
  localStorage.setItem(K, JSON.stringify(list));
}

export function getProject(id: string): Project | undefined {
  return loadProjects().find(p => p.id === id);
}

export function upsertProject(p: Project) {
  const all = loadProjects();
  const i = all.findIndex(x => x.id === p.id);
  p.updatedAt = Date.now();
  if (i >= 0) all[i] = p; else all.unshift(p);
  saveProjects(all);
}

export function deleteProject(id: string) {
  saveProjects(loadProjects().filter(p => p.id !== id));
}

export function duplicateProject(id: string): Project | undefined {
  const p = getProject(id); if (!p) return;
  const copy: Project = {
    ...p,
    id: crypto.randomUUID(),
    name: p.name + " (cópia)",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  upsertProject(copy);
  return copy;
}

export function newProject(type: ProjectType, name: string, meta: Project["meta"] = {}): Project {
  return {
    id: crypto.randomUUID(),
    name, type,
    createdAt: Date.now(), updatedAt: Date.now(),
    slides: [], meta,
  };
}

// --- Library uploads ---
export interface LibItem { id: string; url: string; name: string; addedAt: number }
const LK = "inlabs.library";
export function loadLibrary(): LibItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LK) || "[]"); } catch { return []; }
}
export function addLibrary(item: LibItem) {
  const all = loadLibrary(); all.unshift(item);
  localStorage.setItem(LK, JSON.stringify(all.slice(0, 200)));
}
export function removeLibrary(id: string) {
  localStorage.setItem(LK, JSON.stringify(loadLibrary().filter(i => i.id !== id)));
}

// Favorite fonts
const FK = "inlabs.fonts";
export function loadFavFonts(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(FK) || "[]"); } catch { return []; }
}
export function toggleFavFont(name: string) {
  const cur = loadFavFonts();
  const next = cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name];
  localStorage.setItem(FK, JSON.stringify(next));
}
