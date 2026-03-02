"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { FormatTemplate } from "@/lib/store/types";
import { MeetingTypeSelector } from "@/components/meeting-type-selector";
import { ReferenceSelector } from "@/components/reference-selector";

interface MeetingInfo {
  meetingName: string;
  meetingType: string;
  date: string;
  location: string;
  attendees: string;
  transcript: string;
  templateId: string;
  selectedReferenceIds: string[];
}

interface TranscriptInputProps {
  meetingInfo: MeetingInfo;
  templates: FormatTemplate[];
  onChange: (info: MeetingInfo) => void;
  onNext: () => void;
}

export function TranscriptInput({
  meetingInfo,
  templates,
  onChange,
  onNext,
}: TranscriptInputProps) {
  const update = (field: keyof MeetingInfo, value: string) => {
    onChange({ ...meetingInfo, [field]: value });
  };

  const canProceed =
    meetingInfo.transcript.trim().length > 0 &&
    meetingInfo.meetingType.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Row 1: Meeting type + supplementary name */}
      <div className="grid grid-cols-2 gap-4">
        <MeetingTypeSelector
          value={meetingInfo.meetingType}
          onChange={(v) => update("meetingType", v)}
        />
        <div className="space-y-2">
          <Label htmlFor="meetingName">会議名（補足）</Label>
          <Input
            id="meetingName"
            value={meetingInfo.meetingName}
            onChange={(e) => update("meetingName", e.target.value)}
            placeholder="例: 第10回、2026年3月度"
          />
          <p className="text-xs text-muted-foreground">
            ヘッダー例: 「{meetingInfo.meetingName || "3月度"}{" "}
            {meetingInfo.meetingType || "理事会"} 議事録」
          </p>
        </div>
      </div>

      {/* Row 2: Date, Location, Template */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">開催日</Label>
          <Input
            id="date"
            type="date"
            value={meetingInfo.date}
            onChange={(e) => update("date", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">開催場所</Label>
          <Input
            id="location"
            value={meetingInfo.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="例: 連盟会議室"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="templateId">フォーマットテンプレート</Label>
          <select
            id="templateId"
            value={meetingInfo.templateId}
            onChange={(e) => update("templateId", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">デフォルト（FMPJ標準）</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendees */}
      <div className="space-y-2">
        <Label htmlFor="attendees">出席者（改行区切り）</Label>
        <Textarea
          id="attendees"
          value={meetingInfo.attendees}
          onChange={(e) => update("attendees", e.target.value)}
          placeholder={"山田太郎\n佐藤花子\n田中一郎"}
          rows={3}
        />
      </div>

      {/* Reference materials */}
      <ReferenceSelector
        selectedIds={meetingInfo.selectedReferenceIds}
        onChange={(ids) =>
          onChange({ ...meetingInfo, selectedReferenceIds: ids })
        }
      />

      {/* Transcript */}
      <div className="space-y-2">
        <Label htmlFor="transcript">
          文字起こしデータ <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="transcript"
          value={meetingInfo.transcript}
          onChange={(e) => update("transcript", e.target.value)}
          placeholder={`ここに文字起こしデータを貼り付けてください...\n\n例:\nSpeaker 1 00:00\n本日はよろしくお願いします。\n\nSpeaker 2 00:15\nはい、それでは議事に入ります。`}
          rows={16}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          PLAUD等のAIボイスレコーダーから出力された文字起こしテキストを貼り付けてください。
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          次へ：話者を特定する
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
