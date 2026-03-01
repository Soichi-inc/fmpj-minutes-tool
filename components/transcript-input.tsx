"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

interface MeetingInfo {
  meetingName: string;
  date: string;
  location: string;
  attendees: string;
  transcript: string;
}

interface TranscriptInputProps {
  meetingInfo: MeetingInfo;
  onChange: (info: MeetingInfo) => void;
  onNext: () => void;
}

export function TranscriptInput({
  meetingInfo,
  onChange,
  onNext,
}: TranscriptInputProps) {
  const update = (field: keyof MeetingInfo, value: string) => {
    onChange({ ...meetingInfo, [field]: value });
  };

  const canProceed =
    meetingInfo.transcript.trim().length > 0 &&
    meetingInfo.meetingName.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="meetingName">
            会議名 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="meetingName"
            value={meetingInfo.meetingName}
            onChange={(e) => update("meetingName", e.target.value)}
            placeholder="例: 第○回理事会"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">開催日</Label>
          <Input
            id="date"
            type="date"
            value={meetingInfo.date}
            onChange={(e) => update("date", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
          <Label htmlFor="attendees">出席者（改行区切り）</Label>
          <Textarea
            id="attendees"
            value={meetingInfo.attendees}
            onChange={(e) => update("attendees", e.target.value)}
            placeholder={"山田太郎\n佐藤花子\n田中一郎"}
            rows={3}
          />
        </div>
      </div>

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
          タイムスタンプ付き・なし両方に対応しています。
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
