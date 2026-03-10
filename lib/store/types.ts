export interface FormatTemplate {
  id: string;
  name: string;
  meetingType: string;
  description: string;
  formatInstructions: string;
  sampleOutput: string;
  createdAt: string;
  updatedAt: string;
}

export interface MinutesRecord {
  id: string;
  meetingName: string;
  meetingType: string;
  date: string;
  location: string;
  attendees: string[];
  content: string;
  templateId: string | null;
  createdAt: string;
}

export interface SpeakerEntry {
  name: string;
  title: string; // 肩書き（例: 代表取締役社長、事務局長）
}

export interface TermEntry {
  term: string;
  reading?: string;
  category: string; // 人名, 組織名, プロジェクト名, 専門用語, その他
}

export interface LearningPair {
  id: string;
  meetingType: string;
  meetingName: string;
  date: string;
  originalContent: string; // AI生成ドラフト (A) or 文字起こし
  finalContent: string; // 確定版 (A')
  terminology?: TermEntry[]; // 自動抽出された用語辞書
  createdAt: string;
}

export interface MeetingInfo {
  meetingName: string;
  meetingType: string;
  date: string;
  location: string;
  attendees: string;
  attendeeCategories: Record<string, string>;
  transcript: string;
  templateId: string;
  selectedReferenceIds: string[];
}

export const DEFAULT_MEETING_TYPES = [
  "理事会",
  "委員会",
  "総会",
  "部会",
  "ワーキンググループ",
  "その他",
];
