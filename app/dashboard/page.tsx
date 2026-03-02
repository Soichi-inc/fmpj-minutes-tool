"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TranscriptInput } from "@/components/transcript-input";
import { SpeakerMapping } from "@/components/speaker-mapping";
import { MinutesViewer } from "@/components/minutes-viewer";
import {
  replaceSpeakers,
  filterExcludedSpeakers,
} from "@/lib/utils/speaker-detector";
import { parseTranscript } from "@/lib/utils/transcript-parser";
import { getTemplates, saveMinutesRecord } from "@/lib/store/storage";
import { FormatTemplate } from "@/lib/store/types";
import { Loader2, StopCircle } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

export interface MeetingInfo {
  meetingName: string;
  meetingType: string;
  date: string;
  location: string;
  attendees: string;
  transcript: string;
  templateId: string;
  selectedReferenceIds: string[];
}

const STEP_LABELS = ["会議情報入力", "話者特定", "生成中", "結果表示"];

export default function DashboardPage() {
  const [step, setStep] = useState<Step>(1);
  const [templates, setTemplates] = useState<FormatTemplate[]>([]);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo>({
    meetingName: "",
    meetingType: "",
    date: new Date().toISOString().split("T")[0],
    location: "",
    attendees: "",
    transcript: "",
    templateId: "",
    selectedReferenceIds: [],
  });
  const [generatedContent, setGeneratedContent] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  const attendeesList = meetingInfo.attendees
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const selectedTemplate = templates.find(
    (t) => t.id === meetingInfo.templateId
  );

  const handleGenerate = useCallback(
    async (processedTranscript: string) => {
      setStep(3);
      setStreamingContent("");
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
              (r): r is PromiseFulfilledResult<{ fileName: string; text: string } | null> =>
                r.status === "fulfilled"
            )
            .map((r) => r.value)
            .filter(Boolean) as { fileName: string; text: string }[];
        }

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
            location: meetingInfo.location,
            attendees: attendeesList,
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                setGeneratedContent(accumulated);
                setStep(4);
                // Save to history
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
                  content: accumulated,
                  templateId: meetingInfo.templateId || null,
                  createdAt: new Date().toISOString(),
                });
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                if (parsed.text) {
                  accumulated += parsed.text;
                  setStreamingContent(accumulated);
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        if (accumulated) {
          setGeneratedContent(accumulated);
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
            content: accumulated,
            templateId: meetingInfo.templateId || null,
            createdAt: new Date().toISOString(),
          });
          setStep(4);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          if (streamingContent) {
            setGeneratedContent(streamingContent);
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
    [meetingInfo, attendeesList, selectedTemplate, streamingContent]
  );

  const handleSpeakerConfirm = (
    mapping: Record<string, string>,
    excludedLabels: string[]
  ) => {
    let cleaned = parseTranscript(meetingInfo.transcript);

    // Filter out excluded speakers first
    if (excludedLabels.length > 0) {
      cleaned = filterExcludedSpeakers(cleaned, excludedLabels);
    }

    // Then replace remaining speaker labels with real names
    const processed =
      Object.keys(mapping).length > 0
        ? replaceSpeakers(cleaned, mapping)
        : cleaned;
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
      location: "",
      attendees: "",
      transcript: "",
      templateId: "",
      selectedReferenceIds: [],
    });
    setGeneratedContent("");
    setStreamingContent("");
    setError("");
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as Step;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum;
          return (
            <div key={label} className="flex items-center">
              {i > 0 && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    isCompleted ? "bg-primary" : "bg-gray-200"
                  }`}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    isActive || isCompleted
                      ? "bg-primary text-primary-foreground"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {stepNum}
                </div>
                <span
                  className={`text-sm hidden sm:inline ${
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
      <div className="max-w-4xl mx-auto">
        {step === 1 && (
          <TranscriptInput
            meetingInfo={meetingInfo}
            templates={templates}
            onChange={setMeetingInfo}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <SpeakerMapping
            transcript={meetingInfo.transcript}
            attendees={attendeesList}
            onBack={() => setStep(1)}
            onConfirm={handleSpeakerConfirm}
          />
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <h3 className="text-lg font-medium">議事録を生成中...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Claude AIが議事録を作成しています。しばらくお待ちください。
              </p>
            </div>

            {streamingContent && (
              <div className="border rounded-lg p-6 bg-white prose prose-sm max-w-none min-h-[200px]">
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {streamingContent}
                </pre>
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">
                <p className="font-medium">エラーが発生しました</p>
                <p className="mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
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
              <Button variant="outline" onClick={handleCancel}>
                <StopCircle className="mr-2 h-4 w-4" />
                キャンセル
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <MinutesViewer content={generatedContent} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
