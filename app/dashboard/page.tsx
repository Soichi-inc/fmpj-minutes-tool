"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TranscriptInput } from "@/components/transcript-input";
import { SpeakerMapping } from "@/components/speaker-mapping";
import { MinutesViewer } from "@/components/minutes-viewer";
import { parseTranscript } from "@/lib/utils/transcript-parser";
import { getTemplates, saveMinutesRecord } from "@/lib/store/storage";
import { FormatTemplate, MeetingInfo, UtteranceSample } from "@/lib/store/types";
import { Loader2, StopCircle, Check } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["会議情報入力", "発言者特定", "生成中", "結果表示"];

/**
 * attendeeCategories をパースして { カテゴリ名: string[] } に変換
 */
function parseCategories(
  categories: Record<string, string>
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(categories)) {
    const names = val
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length > 0) {
      result[key] = names;
    }
  }
  return result;
}

/**
 * 全カテゴリの出席者名をフラット配列にする
 */
function flattenAttendees(
  meetingType: string,
  categories: Record<string, string>,
  freeText: string
): string[] {
  if (meetingType === "理事会" || meetingType === "常任理事会") {
    const all: string[] = [];
    for (const val of Object.values(categories)) {
      const names = val
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      all.push(...names);
    }
    return all;
  }
  return freeText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 発言者ヒントをフォーマットする
 */
function formatSpeakerHints(hints: UtteranceSample[]): string {
  if (hints.length === 0) return "";
  const lines = hints.map(
    (h) => `- ${h.timestamp}付近「${h.text}」→ ${h.speaker}`
  );
  return `\n\n■ 発言者の手がかり（ユーザーによる特定）\n${lines.join("\n")}`;
}

export default function DashboardPage() {
  const [step, setStep] = useState<Step>(1);
  const [templates] = useState<FormatTemplate[]>(() => getTemplates());
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo>({
    meetingName: "",
    meetingType: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "",
    endTime: "",
    location: "",
    attendees: "",
    attendeeCategories: {},
    transcript: "",
    templateId: "",
    selectedReferenceIds: [],
  });
  const [generatedContent, setGeneratedContent] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef("");

  const attendeesList = flattenAttendees(
    meetingInfo.meetingType,
    meetingInfo.attendeeCategories,
    meetingInfo.attendees
  );

  const selectedTemplate = templates.find(
    (t) => t.id === meetingInfo.templateId
  );

  const handleGenerate = useCallback(
    async (processedTranscript: string) => {
      setStep(3);
      setStreamingContent("");
      streamingContentRef.current = "";
      setError("");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Fetch reference texts if any are selected
        let referenceTexts: { fileName: string; text: string }[] | undefined;
        if (meetingInfo.selectedReferenceIds.length > 0) {
          const refResults = await Promise.allSettled(
            meetingInfo.selectedReferenceIds.map(async (id) => {
              const res = await fetch(`/api/reference/${id}`);
              if (!res.ok) return null;
              const data = await res.json();
              return { fileName: data.fileName, text: data.text };
            })
          );
          referenceTexts = refResults
            .filter(
              (
                r
              ): r is PromiseFulfilledResult<{
                fileName: string;
                text: string;
              } | null> => r.status === "fulfilled"
            )
            .map((r) => r.value)
            .filter(Boolean) as { fileName: string; text: string }[];
        }

        // Build attendeeCategories for structured prompt
        const parsedCategories =
          meetingInfo.meetingType === "理事会" ||
          meetingInfo.meetingType === "常任理事会"
            ? parseCategories(meetingInfo.attendeeCategories)
            : undefined;

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: processedTranscript,
            meetingName: [meetingInfo.meetingName, meetingInfo.meetingType]
              .filter(Boolean)
              .join(" "),
            meetingType: meetingInfo.meetingType,
            date: meetingInfo.date,
            startTime: meetingInfo.startTime,
            endTime: meetingInfo.endTime,
            location: meetingInfo.location,
            attendees: attendeesList,
            attendeeCategories: parsedCategories,
            customFormatInstructions:
              selectedTemplate?.formatInstructions || "",
            sampleOutput: selectedTemplate?.sampleOutput || "",
            referenceTexts,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "生成に失敗しました");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("ストリームを開始できません");

        const decoder = new TextDecoder();
        let accumulated = "";
        let sseBuffer = "";

        const saveRecord = (content: string) => {
          saveMinutesRecord({
            id: crypto.randomUUID(),
            meetingName: meetingInfo.meetingName,
            meetingType:
              meetingInfo.meetingType ||
              selectedTemplate?.meetingType ||
              "その他",
            date: meetingInfo.date,
            location: meetingInfo.location,
            attendees: attendeesList,
            content,
            templateId: meetingInfo.templateId || null,
            createdAt: new Date().toISOString(),
          });
        };

        const processSSELine = (line: string): boolean => {
          if (!line.startsWith("data: ")) return false;
          const data = line.slice(6);
          if (data === "[DONE]") {
            setGeneratedContent(accumulated);
            setStep(4);
            saveRecord(accumulated);
            return true;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              accumulated += parsed.text;
              streamingContentRef.current = accumulated;
              setStreamingContent(accumulated);
            }
          } catch (e) {
            if (e instanceof SyntaxError) return false;
            throw e;
          }
          return false;
        };

        let isDone = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            if (processSSELine(line)) {
              isDone = true;
              break;
            }
          }
          if (isDone) return;
        }

        if (sseBuffer.trim()) {
          processSSELine(sseBuffer);
        }

        if (accumulated && !isDone) {
          setGeneratedContent(accumulated);
          saveRecord(accumulated);
          setStep(4);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          const currentContent = streamingContentRef.current;
          if (currentContent) {
            setGeneratedContent(currentContent);
            setStep(4);
          } else {
            setStep(2);
          }
          return;
        }
        const message =
          err instanceof Error ? err.message : "不明なエラーが発生しました";
        setError(message);
      }
    },
    [meetingInfo, attendeesList, selectedTemplate]
  );

  const handleUtteranceConfirm = (speakerHints: UtteranceSample[]) => {
    const cleaned = parseTranscript(meetingInfo.transcript);
    // 発言者ヒントをtranscriptの末尾に追加
    const hintsBlock = formatSpeakerHints(speakerHints);
    const processed = cleaned + hintsBlock;
    handleGenerate(processed);
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const handleReset = () => {
    setStep(1);
    setMeetingInfo({
      meetingName: "",
      meetingType: "",
      date: new Date().toISOString().split("T")[0],
      startTime: "",
      endTime: "",
      location: "",
      attendees: "",
      attendeeCategories: {},
      transcript: "",
      templateId: "",
      selectedReferenceIds: [],
    });
    setGeneratedContent("");
    setStreamingContent("");
    setError("");
  };

  // Step 4 uses wider container
  const containerClass = step === 4 ? "max-w-7xl" : "max-w-4xl";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-10">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as Step;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum;
          return (
            <div key={label} className="flex items-center">
              {i > 0 && (
                <div className="w-12 h-0.5 mx-1 relative">
                  <div className="absolute inset-0 bg-border rounded-full" />
                  {isCompleted && (
                    <div className="absolute inset-0 bg-primary rounded-full transition-all duration-500" />
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                    isCompleted
                      ? "bg-primary text-primary-foreground shadow-premium-sm"
                      : isActive
                        ? "bg-primary text-primary-foreground shadow-premium-md pulse-glow"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`text-sm hidden sm:inline transition-colors ${
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className={`${containerClass} mx-auto`}>
        {step === 1 && (
          <div className="animate-fade-slide-up">
            <TranscriptInput
              meetingInfo={meetingInfo}
              templates={templates}
              onChange={setMeetingInfo}
              onNext={() => setStep(2)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-slide-up">
            <SpeakerMapping
              key={meetingInfo.transcript}
              transcript={meetingInfo.transcript}
              attendees={attendeesList}
              onBack={() => setStep(1)}
              onConfirm={handleUtteranceConfirm}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-slide-up">
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 pulse-glow">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
              <h3 className="text-lg font-medium">議事録を生成中...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Claude AIが議事録を作成しています。しばらくお待ちください。
              </p>
            </div>

            {streamingContent && (
              <div className="border rounded-xl p-6 bg-card shadow-premium-sm prose prose-sm max-w-none min-h-[200px]">
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {streamingContent}
                </pre>
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-sm">
                <p className="font-medium">エラーが発生しました</p>
                <p className="mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 press-effect"
                  onClick={() => {
                    setError("");
                    setStep(2);
                  }}
                >
                  戻ってやり直す
                </Button>
              </div>
            )}

            <div className="flex justify-center">
              <Button variant="outline" onClick={handleCancel} className="press-effect">
                <StopCircle className="mr-2 h-4 w-4" />
                キャンセル
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-slide-up">
            <MinutesViewer
              content={generatedContent}
              meetingType={meetingInfo.meetingType}
              meetingName={meetingInfo.meetingName}
              date={meetingInfo.date}
              onReset={handleReset}
            />
          </div>
        )}
      </div>
    </div>
  );
}
