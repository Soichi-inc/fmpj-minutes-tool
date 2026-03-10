import { FormatTemplate, MinutesRecord } from "./types";

const TEMPLATES_KEY = "fmpj-templates";
const MINUTES_KEY = "fmpj-minutes";
const MAX_MINUTES_RECORDS = 50; // Limit to prevent localStorage overflow

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
  safeSetItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates().filter((t) => t.id !== id);
  safeSetItem(TEMPLATES_KEY, JSON.stringify(templates));
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
  // Keep only the most recent records to prevent localStorage overflow
  const trimmed = records.slice(0, MAX_MINUTES_RECORDS);
  safeSetItem(MINUTES_KEY, JSON.stringify(trimmed));
}

export function deleteMinutesRecord(id: string): void {
  const records = getMinutesRecords().filter((r) => r.id !== id);
  safeSetItem(MINUTES_KEY, JSON.stringify(records));
}

// --- Helper ---

/**
 * Safely write to localStorage with quota error handling.
 * If QuotaExceededError occurs, try removing oldest minutes records first.
 */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" || e.code === 22)
    ) {
      // Try to free space by trimming minutes history
      try {
        const records = getMinutesRecords();
        if (records.length > 5) {
          const trimmed = records.slice(0, Math.floor(records.length / 2));
          localStorage.setItem(MINUTES_KEY, JSON.stringify(trimmed));
          // Retry the original save
          localStorage.setItem(key, value);
        }
      } catch {
        console.warn("localStorage quota exceeded and could not free space");
      }
    }
  }
}
