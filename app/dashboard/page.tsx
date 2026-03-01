"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TranscriptInput } from "@/components/transcript-input";
import { SpeakerMapping } from "@/components/speaker-mapping";
import { MinutesViewer } from "@/components/minutes-viewer";
import { replaceSpeakers } from "@/lib/utils/speaker-detector";
import { parseTranscript } from "@/lib/utils/transcript-parser";
import { LogOut, Loader2, StopCircle } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

interface MeetingInfo {
  meetingName: string;
  date: string;
  location: string;
  attendees: string;
  transcript: string;
}

const STEP_LABELS = [
  "会議情報入力",
  "話者特定",
  "生成中",
  "結果表示",
];

export default function DashboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo>({
    meetingName: "",
    date: new Date().toISOString().split("T")[0],
    location: "",
    attendees: "",
    transcript: "",
  });
  const [generatedContent, setGeneratedContent] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const attendeesList = meetingInfo.attendees
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  const handleGenerate = useCallback(
    async (processedTranscript: string) => {
      setStep(3);
      setStreamingContent("");
      setError("");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: processedTranscript,
            meetingName: meetingInfo.meetingName,
            date: meetingInfo.date,
            location: meetingInfo.location,
            attendees: attendeesList,
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

        // If we get here without [DONE], still show results
        if (accumulated) {
          setGeneratedContent(accumulated);
          setStep(4);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled
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
    [meetingInfo, attendeesList, streamingContent]
  );

  const handleSpeakerConfirm = (mapping: Record<string, string>) => {
    const cleaned = parseTranscript(meetingInfo.transcript);
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
      date: new Date().toISOString().split("T")[0],
      location: "",
      attendees: "",
      transcript: "",
    });
    setGeneratedContent("");
    setStreamingContent("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <h1 className="font-semibold text-lg">
            {process.env.NEXT_PUBLIC_APP_NAME || "FMPJ議事録ツール"}
          </h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
          </Button>
        </div>
      </header>

      {/* Step indicator */}
      <div className="max-w-6xl mx-auto px-6 py-6">
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
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
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
            <MinutesViewer
              content={generatedContent}
              onReset={handleReset}
            />
          )}
        </div>
      </div>
    </div>
  );
}
