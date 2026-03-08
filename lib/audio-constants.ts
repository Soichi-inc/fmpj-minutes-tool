/** Supported audio file extensions for transcription */
export const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".webm",
  ".mp4",
  ".mpeg",
  ".mpga",
];

/** Audio MIME type to extensions mapping (for react-dropzone accept) */
export const AUDIO_ACCEPT_TYPES: Record<string, string[]> = {
  "audio/mpeg": [".mp3", ".mpeg", ".mpga"],
  "audio/wav": [".wav"],
  "audio/x-wav": [".wav"],
  "audio/mp4": [".m4a", ".mp4"],
  "audio/x-m4a": [".m4a"],
  "audio/webm": [".webm"],
};

/** Max audio file size: 25MB (OpenAI Whisper API limit) */
export const MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024;
