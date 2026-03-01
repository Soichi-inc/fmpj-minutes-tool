/**
 * Clean and normalize transcript text.
 * Handles various PLAUD output formats.
 */
export function parseTranscript(raw: string): string {
  let text = raw.trim();

  // Normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove excessive blank lines (keep max 2)
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
}

/**
 * Extract timestamp from a speaker line if present.
 * Returns the timestamp string or null.
 */
export function extractTimestamp(line: string): string | null {
  const match = line.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  return match ? match[1] : null;
}

/**
 * Validate that the transcript contains recognizable speaker patterns.
 */
export function hasRecognizableSpeakers(transcript: string): boolean {
  const speakerPattern = /^(Speaker\s*\d+|話者\s*\d+)/im;
  return speakerPattern.test(transcript);
}
