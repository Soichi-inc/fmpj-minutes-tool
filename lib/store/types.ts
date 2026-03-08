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

export interface LearningPair {
  id: string;
  meetingType: string;
  meetingName: string;
  date: string;
  originalContent: string; // AI生成ドラフト (A) or 文字起こし
  finalContent: string; // 確定版 (A')
  createdAt: string;
}

export const DEFAULT_MEETING_TYPES = [
  "理事会",
  "委員会",
  "総会",
  "部会",
  "ワーキンググループ",
  "その他",
];
