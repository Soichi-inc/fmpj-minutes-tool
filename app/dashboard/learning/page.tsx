"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileAudio,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { upload } from "@vercel/blob/client";
import { MeetingTypeSelector } from "@/components/meeting-type-selector";
import {
  AUDIO_ACCEPT_TYPES,
  MAX_AUDIO_FILE_SIZE,
  SUPPORTED_AUDIO_EXTENSIONS,
} from "@/lib/audio-constants";

interface LearningEntry {
  id: string;
  meetingType: string;
  meetingName: string;
  date: string;
  createdAt: string;
  originalLength: number;
  finalLength: number;
}

export default function LearningPage() {
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<{
    originalContent: string;
    finalContent: string;
  } | null>(null);

  // Import form states
  const [showImport, setShowImport] = useState(false);
  const [importMeetingType, setImportMeetingType] = useState("");
  const [importMeetingName, setImportMeetingName] = useState("");
  const [importDate, setImportDate] = useState("");

  // Audio import
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState("");
  const [transcribedText, setTranscribedText] = useState("");
  const [audioError, setAudioError] = useState("");

  // Minutes file import
  const [minutesText, setMinutesText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/learning/list");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.learningPairs || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleDelete = async (id: string) => {
    if (!confirm("この学習データを削除しますか？")) return;
    try {
      const res = await fetch(`/api/learning/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        if (expandedId === id) {
          setExpandedId(null);
          setExpandedData(null);
        }
      }
    } catch {
      // Ignore
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedData(null);
      return;
    }
    setExpandedId(id);
    setExpandedData(null);
    try {
      const res = await fetch(`/api/learning/${id}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedData({
          originalContent: data.originalContent || "",
          finalContent: data.finalContent || "",
        });
      }
    } catch {
      // Ignore
    }
  };

  // Audio dropzone
  const onAudioDrop = useCallback((acceptedFiles: File[]) => {
    setAudioError("");
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
      setAudioError(
        `対応していない形式です。対応形式: ${SUPPORTED_AUDIO_EXTENSIONS.join(", ")}`
      );
      return;
    }
    if (file.size > MAX_AUDIO_FILE_SIZE) {
      setAudioError(
        `ファイルサイズが25MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）`
      );
      return;
    }
    setAudioFile(file);
  }, []);

  const {
    getRootProps: getAudioRootProps,
    getInputProps: getAudioInputProps,
    isDragActive: isAudioDragActive,
  } = useDropzone({
    onDrop: onAudioDrop,
    accept: AUDIO_ACCEPT_TYPES,
    maxFiles: 1,
    disabled: isTranscribing,
  });

  const handleTranscribeAudio = async () => {
    if (!audioFile) return;
    setIsTranscribing(true);
    setAudioError("");
    setTranscriptionStatus("アップロード中...");

    try {
      const blob = await upload(audioFile.name, audioFile, {
        access: "public",
        handleUploadUrl: "/api/audio/upload",
      });

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
            if (
              parsed.status === "downloading" ||
              parsed.status === "transcribing"
            ) {
              setTranscriptionStatus(parsed.message);
            } else if (parsed.status === "done") {
              setTranscribedText(parsed.transcript);
              setTranscriptionStatus("文字起こし完了");
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
      setAudioError(
        err instanceof Error ? err.message : "文字起こしに失敗しました"
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  // Minutes file import
  const handleMinutesFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    setExtractError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/learning/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "テキスト抽出に失敗しました");
      }
      const data = await res.json();
      setMinutesText(data.text);
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "テキスト抽出に失敗しました"
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveImport = async () => {
    if (!minutesText.trim()) return;
    setIsSaving(true);
    setSaveMessage("");

    try {
      const res = await fetch("/api/learning/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingType: importMeetingType || "その他",
          meetingName: importMeetingName,
          date: importDate,
          originalContent: transcribedText,
          finalContent: minutesText,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存に失敗しました");
      }

      setSaveMessage("学習データを保存しました");
      // Reset form
      setImportMeetingType("");
      setImportMeetingName("");
      setImportDate("");
      setAudioFile(null);
      setTranscribedText("");
      setMinutesText("");
      setTranscriptionStatus("");
      fetchEntries();
    } catch (err) {
      setSaveMessage(
        `エラー: ${err instanceof Error ? err.message : "保存に失敗しました"}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            学習データ管理
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            過去の議事録データを登録して、AI生成の品質を向上させます。
          </p>
        </div>
        <Button onClick={() => setShowImport(!showImport)}>
          <Upload className="mr-2 h-4 w-4" />
          過去データをインポート
        </Button>
      </div>

      {/* Import form */}
      {showImport && (
        <div className="border rounded-lg p-6 space-y-5 bg-white">
          <h3 className="font-medium">過去データのインポート</h3>

          {/* Step 1: Meeting info */}
          <div className="grid grid-cols-3 gap-4">
            <MeetingTypeSelector
              value={importMeetingType}
              onChange={setImportMeetingType}
            />
            <div className="space-y-2">
              <Label>会議名（補足）</Label>
              <Input
                value={importMeetingName}
                onChange={(e) => setImportMeetingName(e.target.value)}
                placeholder="例: 第10回"
              />
            </div>
            <div className="space-y-2">
              <Label>開催日</Label>
              <Input
                type="date"
                value={importDate}
                onChange={(e) => setImportDate(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Step 2: Audio file (optional) */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <FileAudio className="h-4 w-4" />
              音声ファイル（任意）
            </Label>
            <p className="text-xs text-muted-foreground">
              音声ファイルがある場合、文字起こしして元データ(A)として保存します。スキップ可。
            </p>

            {!audioFile && !isTranscribing && !transcribedText && (
              <div
                {...getAudioRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isAudioDragActive
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/50"
                }`}
              >
                <input {...getAudioInputProps()} />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm">
                  音声ファイルをドラッグ＆ドロップ（MP3, WAV, M4A / 最大25MB）
                </p>
              </div>
            )}

            {audioFile && !isTranscribing && !transcribedText && (
              <div className="border rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileAudio className="h-5 w-5 text-primary" />
                  <span className="text-sm">{audioFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(audioFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAudioFile(null)}
                  >
                    削除
                  </Button>
                  <Button size="sm" onClick={handleTranscribeAudio}>
                    文字起こし開始
                  </Button>
                </div>
              </div>
            )}

            {isTranscribing && (
              <div className="border rounded-lg p-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm">{transcriptionStatus}</p>
              </div>
            )}

            {transcribedText && (
              <div className="border rounded-lg p-3 bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    文字起こし完了（{transcribedText.length}文字）
                  </span>
                </div>
                <Textarea
                  value={transcribedText}
                  onChange={(e) => setTranscribedText(e.target.value)}
                  rows={4}
                  className="text-xs font-mono"
                />
              </div>
            )}

            {audioError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {audioError}
              </p>
            )}
          </div>

          <Separator />

          {/* Step 3: Minutes file (required) */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              確定済み議事録（A&apos;） <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              過去の確定済み議事録ファイル（Word/PDF/テキスト）をアップロードするか、直接テキストを貼り付けてください。
            </p>

            <div className="flex gap-3 items-center">
              <div className="relative">
                <input
                  type="file"
                  accept=".docx,.pdf,.txt,.doc"
                  onChange={handleMinutesFile}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isExtracting}
                />
                <Button variant="outline" size="sm" disabled={isExtracting}>
                  {isExtracting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  ファイルから読み込み
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                Word (.docx), PDF, テキスト対応
              </span>
            </div>

            {extractError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {extractError}
              </p>
            )}

            <Textarea
              value={minutesText}
              onChange={(e) => setMinutesText(e.target.value)}
              rows={10}
              placeholder="確定済み議事録のテキストをここに貼り付けるか、上のボタンからファイルを読み込んでください..."
              className="font-mono text-sm"
            />
          </div>

          {saveMessage && (
            <p
              className={`text-sm ${saveMessage.startsWith("エラー") ? "text-destructive" : "text-green-600"}`}
            >
              {saveMessage}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowImport(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSaveImport}
              disabled={isSaving || !minutesText.trim()}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="mr-2 h-4 w-4" />
              )}
              学習データとして保存
            </Button>
          </div>
        </div>
      )}

      <Separator />

      {/* List of existing learning entries */}
      <div className="space-y-3">
        <h3 className="font-medium">
          保存済み学習データ（{entries.length}件）
        </h3>

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              学習データはまだありません。議事録生成後に「確定版として保存」するか、
              上の「過去データをインポート」から登録できます。
            </p>
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="border rounded-lg bg-white">
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleExpand(entry.id)}
            >
              <div className="flex items-center gap-4">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {entry.meetingType}
                    {entry.meetingName ? ` - ${entry.meetingName}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.date || "日付未設定"} ・ 確定版{" "}
                    {entry.finalLength.toLocaleString()}文字
                    {entry.originalLength > 0 &&
                      ` ・ 元データ ${entry.originalLength.toLocaleString()}文字`}
                    ・ {new Date(entry.createdAt).toLocaleDateString("ja-JP")}
                    登録
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(entry.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                {expandedId === entry.id ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {expandedId === entry.id && (
              <div className="border-t px-4 py-3 space-y-3">
                {!expandedData ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {expandedData.originalContent && (
                      <div className="space-y-1">
                        <Label className="text-xs">元データ (A)</Label>
                        <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap font-mono">
                          {expandedData.originalContent}
                        </pre>
                      </div>
                    )}
                    <div
                      className={`space-y-1 ${!expandedData.originalContent ? "col-span-2" : ""}`}
                    >
                      <Label className="text-xs">確定版 (A&apos;)</Label>
                      <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap font-mono">
                        {expandedData.finalContent}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
