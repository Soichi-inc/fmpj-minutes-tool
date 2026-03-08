"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  FileAudio,
  Type,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { upload } from "@vercel/blob/client";
import { FormatTemplate } from "@/lib/store/types";
import { MeetingTypeSelector } from "@/components/meeting-type-selector";
import { ReferenceSelector } from "@/components/reference-selector";
import { AttendeeInput } from "@/components/attendee-input";
import {
  AUDIO_ACCEPT_TYPES,
  MAX_AUDIO_FILE_SIZE,
  SUPPORTED_AUDIO_EXTENSIONS,
} from "@/lib/audio-constants";

interface MeetingInfo {
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
  const [inputMode, setInputMode] = useState<"text" | "audio">("text");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState("");
  const [transcriptionError, setTranscriptionError] = useState("");
  const [transcriptionDone, setTranscriptionDone] = useState(false);

  const update = (field: keyof MeetingInfo, value: string) => {
    onChange({ ...meetingInfo, [field]: value });
  };

  const canProceed =
    meetingInfo.transcript.trim().length > 0 &&
    meetingInfo.meetingType.trim().length > 0;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setTranscriptionError("");
    setTranscriptionDone(false);
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
      setTranscriptionError(
        `対応していない形式です。対応形式: ${SUPPORTED_AUDIO_EXTENSIONS.join(", ")}`
      );
      return;
    }
    if (file.size > MAX_AUDIO_FILE_SIZE) {
      setTranscriptionError(
        `ファイルサイズが25MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）。MP3に変換するか分割してください。`
      );
      return;
    }
    setAudioFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: AUDIO_ACCEPT_TYPES,
    maxFiles: 1,
    disabled: isTranscribing,
  });

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setIsTranscribing(true);
    setTranscriptionError("");
    setTranscriptionStatus("アップロード中...");

    try {
      // Step 1: Upload to Vercel Blob
      const blob = await upload(audioFile.name, audioFile, {
        access: "public",
        handleUploadUrl: "/api/audio/upload",
      });

      // Step 2: Call transcribe API with SSE
      setTranscriptionStatus("文字起こし開始...");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, fileName: audioFile.name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "文字起こしに失敗しました");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("ストリームを開始できません");

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.status === "downloading" || parsed.status === "transcribing") {
              setTranscriptionStatus(parsed.message);
            } else if (parsed.status === "done") {
              update("transcript", parsed.transcript);
              setTranscriptionDone(true);
              setTranscriptionStatus("文字起こし完了");
              setInputMode("text"); // Switch to text tab to show result
            } else if (parsed.status === "error") {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err) {
      setTranscriptionError(
        err instanceof Error ? err.message : "文字起こしに失敗しました"
      );
    } finally {
      setIsTranscribing(false);
    }
  };

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
      <AttendeeInput
        meetingType={meetingInfo.meetingType}
        categories={meetingInfo.attendeeCategories}
        onCategoriesChange={(cats) =>
          onChange({ ...meetingInfo, attendeeCategories: cats })
        }
        freeText={meetingInfo.attendees}
        onFreeTextChange={(text) =>
          onChange({ ...meetingInfo, attendees: text })
        }
      />

      {/* Reference materials */}
      <ReferenceSelector
        selectedIds={meetingInfo.selectedReferenceIds}
        onChange={(ids) =>
          onChange({ ...meetingInfo, selectedReferenceIds: ids })
        }
      />

      {/* Transcript input with tabs */}
      <div className="space-y-3">
        <Label>
          文字起こしデータ <span className="text-destructive">*</span>
        </Label>

        {/* Tab switcher */}
        <div className="flex gap-1 border-b">
          <button
            type="button"
            onClick={() => setInputMode("text")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${
              inputMode === "text"
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Type className="h-4 w-4" />
            テキスト貼り付け
          </button>
          <button
            type="button"
            onClick={() => setInputMode("audio")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${
              inputMode === "audio"
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileAudio className="h-4 w-4" />
            音声ファイルから文字起こし
          </button>
        </div>

        {/* Text tab */}
        {inputMode === "text" && (
          <div className="space-y-2">
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
        )}

        {/* Audio tab */}
        {inputMode === "audio" && (
          <div className="space-y-4">
            {/* Dropzone */}
            {!audioFile && !isTranscribing && (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                  音声ファイルをドラッグ＆ドロップ
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  またはクリックして選択（MP3, WAV, M4A, WebM / 最大25MB）
                </p>
              </div>
            )}

            {/* File selected */}
            {audioFile && !isTranscribing && !transcriptionDone && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileAudio className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{audioFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAudioFile(null);
                      setTranscriptionError("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={handleTranscribe} className="w-full">
                  <FileAudio className="mr-2 h-4 w-4" />
                  文字起こしを開始
                </Button>
              </div>
            )}

            {/* Transcribing progress */}
            {isTranscribing && (
              <div className="border rounded-lg p-6 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium">{transcriptionStatus}</p>
                <p className="text-xs text-muted-foreground">
                  {audioFile?.name}
                </p>
              </div>
            )}

            {/* Transcription done */}
            {transcriptionDone && !isTranscribing && (
              <div className="border rounded-lg p-4 bg-green-50 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">
                    文字起こし完了
                  </p>
                  <p className="text-xs text-green-600">
                    テキストタブで結果を確認・編集できます
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAudioFile(null);
                    setTranscriptionDone(false);
                    setTranscriptionStatus("");
                  }}
                >
                  別のファイル
                </Button>
              </div>
            )}

            {/* Error */}
            {transcriptionError && (
              <div className="border rounded-lg p-4 bg-destructive/10 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    エラー
                  </p>
                  <p className="text-xs text-destructive/80">
                    {transcriptionError}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAudioFile(null);
                    setTranscriptionError("");
                  }}
                >
                  やり直す
                </Button>
              </div>
            )}
          </div>
        )}
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
