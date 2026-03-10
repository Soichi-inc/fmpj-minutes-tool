export interface DetectedSpeaker {
  id: string;
  label: string;
  count: number;
  /** 最初の発言の冒頭テキスト（話者特定の手がかり用） */
  firstUtterance: string;
}

const MAX_UTTERANCE_LENGTH = 80;

/**
 * Detect unique speakers from transcript text.
 * Supports patterns like:
 * - "Speaker 1 00:00" (with timestamp)
 * - "Speaker 1" (without timestamp)
 * - "話者 1" (Japanese)
 */
export function detectSpeakers(transcript: string): DetectedSpeaker[] {
  const speakerCounts = new Map<string, number>();
  const speakerFirstUtterance = new Map<string, string>();

  const lines = transcript.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(/^(Speaker\s*\d+|話者\s*\d+)/i);
    if (match) {
      const speaker = match[1].replace(/\s+/g, " ").trim();
      // Normalize: "Speaker 1", "speaker 1" -> "Speaker 1"
      const normalized = speaker.replace(/^(speaker|話者)\s*/i, (m) => {
        return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
      });
      speakerCounts.set(normalized, (speakerCounts.get(normalized) || 0) + 1);

      // 最初の発言テキストを取得（まだ未取得の場合）
      if (!speakerFirstUtterance.has(normalized)) {
        // ラベル行の残りテキスト or 次の行から発言テキストを収集
        const afterLabel = trimmed.replace(/^(Speaker\s*\d+|話者\s*\d+)\s*\d{0,2}:?\d{0,2}\s*/i, "").trim();
        const utteranceLines: string[] = [];
        if (afterLabel) {
          utteranceLines.push(afterLabel);
        }
        // 次の行以降から発言テキストを収集
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (!nextLine) break; // 空行で終了
          if (nextLine.match(/^(Speaker\s*\d+|話者\s*\d+)/i)) break; // 次の話者で終了
          utteranceLines.push(nextLine);
          if (utteranceLines.join(" ").length >= MAX_UTTERANCE_LENGTH) break;
        }
        const utterance = utteranceLines.join(" ").slice(0, MAX_UTTERANCE_LENGTH);
        speakerFirstUtterance.set(normalized, utterance + (utteranceLines.join(" ").length > MAX_UTTERANCE_LENGTH ? "..." : ""));
      }
    }
  }

  return Array.from(speakerCounts.entries())
    .map(([label, count]) => ({
      id: label.toLowerCase().replace(/\s+/g, "-"),
      label,
      count,
      firstUtterance: speakerFirstUtterance.get(label) || "",
    }))
    .sort((a, b) => {
      // Sort numerically by speaker number
      const numA = parseInt(a.label.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.label.replace(/\D/g, "")) || 0;
      return numA - numB;
    });
}

/**
 * Filter out transcript blocks belonging to excluded speakers.
 * Removes the speaker label line and all subsequent lines
 * until the next speaker label is encountered.
 */
export function filterExcludedSpeakers(
  transcript: string,
  excludedLabels: string[]
): string {
  if (excludedLabels.length === 0) return transcript;

  const lines = transcript.split("\n");
  const result: string[] = [];
  let excluding = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this line starts with a speaker label
    const match = trimmed.match(/^(Speaker\s*\d+|話者\s*\d+)/i);

    if (match) {
      // Normalize the label the same way detectSpeakers does
      const raw = match[1].replace(/\s+/g, " ").trim();
      const normalizedLabel = raw.replace(/^(speaker|話者)\s*/i, (m) => {
        return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
      });

      excluding = excludedLabels.includes(normalizedLabel);
    }

    if (!excluding) {
      result.push(line);
    }
  }

  // Clean up excessive blank lines left by filtering
  return result.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * Replace speaker labels with real names (+ title) in transcript text.
 * Supports both simple string mapping and SpeakerEntry mapping.
 * Title is concatenated directly: "板垣事務局長", "田中代表取締役社長"
 */
export function replaceSpeakers(
  transcript: string,
  mapping: Record<string, string | { name: string; title: string }>
): string {
  let result = transcript;
  // Sort by label length descending to avoid partial replacements
  const entries = Object.entries(mapping).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [label, entry] of entries) {
    const name = typeof entry === "string" ? entry : entry.name;
    const title = typeof entry === "string" ? "" : entry.title;
    if (!name) continue;

    // Build display name: "板垣事務局長" (name + title directly concatenated)
    const displayName = title ? `${name}${title}` : name;

    // Replace at the start of lines (with optional timestamp)
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escaped}`, "gim");
    result = result.replace(pattern, displayName);
  }

  return result;
}
