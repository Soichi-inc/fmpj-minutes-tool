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

/** Max audio file size: 200MB (large WAV/M4A support; auto-chunked for Whisper) */
export const MAX_AUDIO_FILE_SIZE = 200 * 1024 * 1024;

/** Whisper API per-request limit */
export const WHISPER_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB with margin

/** Max audio duration in minutes (1 meeting = up to 180 min) */
export const MAX_AUDIO_DURATION_MINUTES = 180;

/** Parallel Whisper API concurrency (avoid rate limit) */
export const WHISPER_CONCURRENCY = 3;
