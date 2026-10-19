import type { DawProject, ProjectSummary } from '../types/project';

const LOCAL_STORAGE_KEY = 'daw_mt_saved_projects_v1';

export function listSavedProjects(): ProjectSummary[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const list: DawProject[] = JSON.parse(raw);
    return list.map((p) => ({
      id: p.id,
      name: p.name || 'Sin título',
      updatedAt: p.updatedAt || p.createdAt,
      tracksCount: p.tracks?.length || 0,
      duration: Math.max(0, ...(p.tracks?.map((t) => t.duration) || [0])),
    }));
  } catch (e) {
    console.error('Error al listar proyectos locales:', e);
    return [];
  }
}

export function saveProjectLocally(project: DawProject): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: DawProject[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      list[idx] = project;
    } else {
      list.unshift(project);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error al guardar proyecto en local:', e);
    throw new Error('No se pudo guardar el proyecto en el almacenamiento local');
  }
}

export function loadProjectLocally(id: string): DawProject | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const list: DawProject[] = JSON.parse(raw);
    return list.find((p) => p.id === id) || null;
  } catch (e) {
    console.error('Error al cargar proyecto local:', e);
    return null;
  }
}

export function deleteProjectLocally(id: string): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const list: DawProject[] = JSON.parse(raw);
    const filtered = list.filter((p) => p.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error al eliminar proyecto local:', e);
  }
}

export function exportProjectAsJsonFile(project: DawProject): void {
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (project.name || 'proyecto').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  a.href = url;
  a.download = `${safeName}.daw.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function readProjectFromJsonFile(file: File): Promise<DawProject> {
  const text = await file.text();
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.tracks)) {
    throw new Error('El archivo no contiene un formato de proyecto válido para DAW-MT');
  }
  return obj as DawProject;
}
