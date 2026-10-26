import type { DawProject, ProjectSummary } from '../types/project';
import { isTauri, tauriGetDefaultProjectsDir, tauriSaveProjectFolder } from '../audio/tauriBridge';

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
      tracksCount: p.tracks?.length || (p.songs ? p.songs.reduce((acc, s) => acc + (s.tracks?.length || 0), 0) : 0),
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

/**
 * Guarda el proyecto estructurado en una carpeta completa con:
 * - project.openmt (Archivo maestro del proyecto con pistas, rutas originales y ajustes)
 * - lyrics/<cancion>.lrc (Archivos de letras LRC individuales sincronizadas)
 * - repertorio_setlist.txt (Resumen del concierto y temas para la banda)
 */
export async function saveProjectFolder(
  project: DawProject,
  customFolderPath?: string,
): Promise<{ folderPath: string; mainFilePath: string }> {
  const safeName = (project.name || 'proyecto').trim().replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ ]/g, '_');
  const projectJson = JSON.stringify(project, null, 2);

  // Extraer letras de cada canción
  const lyricsFiles: Array<[string, string]> = [];
  if (project.songs && project.songs.length > 0) {
    project.songs.forEach((song, idx) => {
      const rawLrc = song.lyrics?.rawLrc?.trim();
      if (rawLrc) {
        lyricsFiles.push([`${idx + 1}_${song.name}`, rawLrc]);
      }
    });
  } else if (project.lyrics?.rawLrc?.trim()) {
    lyricsFiles.push(['1_Letra_Principal', project.lyrics.rawLrc.trim()]);
  }

  // Resumen legible
  const summaryText = generateProjectSummaryText(project);

  if (isTauri()) {
    let targetFolder = customFolderPath;
    if (!targetFolder) {
      const defaultDir = await tauriGetDefaultProjectsDir();
      targetFolder = `${defaultDir}\\${safeName}`;
    }

    const savedFile = await tauriSaveProjectFolder(targetFolder, projectJson, lyricsFiles, summaryText);
    return { folderPath: targetFolder, mainFilePath: savedFile };
  }

  // Fallback para Web / Navegador: Descargar archivo .openmt
  exportProjectAsJsonFile(project);
  return { folderPath: 'Descargas', mainFilePath: `${safeName}.openmt` };
}

export function generateProjectSummaryText(project: DawProject): string {
  const dateStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let text = `========================================================\n`;
  text += `   OPENMT DAW — RESUMEN DEL PROYECTO / REPERTORIO EN VIVO\n`;
  text += `========================================================\n\n`;
  text += `Nombre del Proyecto: ${project.name || 'Sin título'}\n`;
  text += `Fecha de guardado:   ${dateStr}\n`;
  text += `Total de canciones:  ${project.songs?.length || 1}\n\n`;

  const songs = project.songs || [];
  if (songs.length > 0) {
    text += `LISTA DE CANCIONES DEL SETLIST:\n`;
    text += `--------------------------------------------------------\n`;
    songs.forEach((s, idx) => {
      const trackCount = s.tracks?.length || 0;
      const secCount = s.sections?.length || 0;
      const hasLrc = Boolean(s.lyrics?.rawLrc?.trim());
      text += `[${idx + 1}] ${s.name}\n`;
      text += `    - Pistas de audio: ${trackCount}\n`;
      text += `    - Secciones detectadas: ${secCount}\n`;
      text += `    - Letra sincronizada: ${hasLrc ? 'Sí (ver carpeta lyrics/)' : 'No'}\n`;
      if (s.tracks && s.tracks.length > 0) {
        text += `    - Pistas:\n`;
        s.tracks.forEach((t) => {
          const origin = t.filePath || t.fileInfo?.path || t.fileInfo?.name || 'Archivo local';
          text += `        * ${t.name} (Origen: ${origin})\n`;
        });
      }
      text += `\n`;
    });
  }

  return text;
}

export function exportProjectAsJsonFile(project: DawProject): void {
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (project.name || 'proyecto').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  a.href = url;
  a.download = `${safeName}.openmt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function readProjectFromJsonFile(file: File): Promise<DawProject> {
  const text = await file.text();
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object' || (!Array.isArray(obj.tracks) && !Array.isArray(obj.songs))) {
    throw new Error('El archivo no contiene un formato de proyecto válido para OpenMT');
  }
  return obj as DawProject;
}
