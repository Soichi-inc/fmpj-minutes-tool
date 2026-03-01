export interface DetectedSpeaker {
  id: string;
  label: string;
  count: number;
}

/**
 * Detect unique speakers from transcript text.
 * Supports patterns like:
 * - "Speaker 1 00:00" (with timestamp)
 * - "Speaker 1" (without timestamp)
 * - "話者 1" (Japanese)
 */
export function detectSpeakers(transcript: string): DetectedSpeaker[] {
  const speakerPattern = /^(Speaker\s*\d+|話者\s*\d+)/gim;
  const speakerCounts = new Map<string, number>();

  const lines = transcript.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(Speaker\s*\d+|話者\s*\d+)/i);
    if (match) {
      const speaker = match[1].replace(/\s+/g, " ").trim();
      // Normalize: "Speaker 1", "speaker 1" -> "Speaker 1"
      const normalized = speaker.replace(/^(speaker|話者)\s*/i, (m) => {
        return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
      });
      speakerCounts.set(normalized, (speakerCounts.get(normalized) || 0) + 1);
    }
  }

  return Array.from(speakerCounts.entries())
    .map(([label, count]) => ({
      id: label.toLowerCase().replace(/\s+/g, "-"),
      label,
      count,
    }))
    .sort((a, b) => {
      // Sort numerically by speaker number
      const numA = parseInt(a.label.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.label.replace(/\D/g, "")) || 0;
      return numA - numB;
    });
}

/**
 * Replace speaker labels with real names in transcript text.
 */
export function replaceSpeakers(
  transcript: string,
  mapping: Record<string, string>
): string {
  let result = transcript;
  // Sort by label length descending to avoid partial replacements
  const entries = Object.entries(mapping).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [label, name] of entries) {
    if (!name) continue;
    // Replace at the start of lines (with optional timestamp)
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escaped}`, "gim");
    result = result.replace(pattern, name);
  }

  return result;
}
