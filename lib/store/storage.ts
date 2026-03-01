import { FormatTemplate, MinutesRecord } from "./types";

const TEMPLATES_KEY = "fmpj-templates";
const MINUTES_KEY = "fmpj-minutes";

// --- Templates ---

export function getTemplates(): FormatTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTemplate(template: FormatTemplate): void {
  const templates = getTemplates();
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = { ...template, updatedAt: new Date().toISOString() };
  } else {
    templates.push(template);
  }
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates().filter((t) => t.id !== id);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

// --- Minutes Records ---

export function getMinutesRecords(): MinutesRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MINUTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMinutesRecord(record: MinutesRecord): void {
  const records = getMinutesRecords();
  records.unshift(record); // newest first
  localStorage.setItem(MINUTES_KEY, JSON.stringify(records));
}

export function deleteMinutesRecord(id: string): void {
  const records = getMinutesRecords().filter((r) => r.id !== id);
  localStorage.setItem(MINUTES_KEY, JSON.stringify(records));
}
