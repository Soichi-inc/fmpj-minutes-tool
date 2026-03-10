"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  MessageSquareQuote,
  Clock,
  UserCheck,
} from "lucide-react";
import { UtteranceSample } from "@/lib/store/types";
import { extractUtteranceSamples } from "@/lib/utils/speaker-detector";

interface SpeakerMappingProps {
  transcript: string;
  attendees: string[];
  onBack: () => void;
  onConfirm: (speakerHints: UtteranceSample[]) => void;
}

export function SpeakerMapping({
  transcript,
  attendees,
  onBack,
  onConfirm,
}: SpeakerMappingProps) {
  const samples = useMemo(
    () => extractUtteranceSamples(transcript),
    [transcript]
  );

  const [hints, setHints] = useState<UtteranceSample[]>(samples);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const updateSpeaker = (index: number, speaker: string) => {
    setHints((prev) =>
      prev.map((h) => (h.index === index ? { ...h, speaker } : h))
    );
  };

  const filledCount = hints.filter((h) => h.speaker.trim()).length;

  const handleConfirm = () => {
    onConfirm(hints.filter((h) => h.speaker.trim()));
  };

  const attendeeOptions = attendees.filter((a) => a.trim());

  if (samples.length === 0) {
    return (
      <div className="bg-card rounded-xl border shadow-premium-sm p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <MessageSquareQuote className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-medium">発言を検出できませんでした</h3>
          <p className="text-sm text-muted-foreground mt-1">
            文字起こしデータからタイムスタンプ付きの発言が見つかりませんでした。
            そのまま議事録の生成に進みます。
          </p>
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={onBack} className="press-effect">
            <ArrowLeft className="mr-2 h-4 w-4" />
            戻る
          </Button>
          <Button
            onClick={() => onConfirm([])}
            className="bg-gradient-primary hover:opacity-90 press-effect shadow-premium-md"
          >
            生成を開始する
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl border shadow-premium-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">発言者の特定</h2>
            <p className="text-sm text-muted-foreground">
              以下の発言を誰が話したか教えてください。わかる範囲で構いません。
            </p>
          </div>
        </div>
      </div>

      {/* Utterance cards */}
      <div className="space-y-3">
        {hints.map((sample) => (
          <UtteranceCard
            key={sample.index}
            sample={sample}
            attendees={attendeeOptions}
            isDropdownOpen={openDropdown === sample.index}
            onToggleDropdown={() =>
              setOpenDropdown(
                openDropdown === sample.index ? null : sample.index
              )
            }
            onCloseDropdown={() => setOpenDropdown(null)}
            onSpeakerChange={(speaker) =>
              updateSpeaker(sample.index, speaker)
            }
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="press-effect">
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {filledCount} / {hints.length} 件特定済み
          </span>
          <Button
            onClick={handleConfirm}
            className="bg-gradient-primary hover:opacity-90 press-effect shadow-premium-md"
          >
            議事録を生成する
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function UtteranceCard({
  sample,
  attendees,
  isDropdownOpen,
  onToggleDropdown,
  onCloseDropdown,
  onSpeakerChange,
}: {
  sample: UtteranceSample;
  attendees: string[];
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
  onSpeakerChange: (speaker: string) => void;
}) {
  const [inputValue, setInputValue] = useState(sample.speaker);

  const filteredAttendees = attendees.filter(
    (a) =>
      !inputValue ||
      a.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onSpeakerChange(value);
  };

  const handleSelect = (name: string) => {
    setInputValue(name);
    onSpeakerChange(name);
    onCloseDropdown();
  };

  return (
    <div
      className={`bg-card rounded-xl border shadow-premium-xs p-5 transition-all ${
        sample.speaker ? "border-primary/30 bg-primary/[0.02]" : ""
      }`}
    >
      {/* Timestamp + utterance */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 mt-0.5">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono">{sample.timestamp}</span>
        </div>
        <p className="text-sm leading-relaxed">
          「{sample.text}」
        </p>
      </div>

      {/* Speaker input */}
      <div className="relative">
        <Label className="text-xs text-muted-foreground mb-1.5 block">
          この発言をした人
        </Label>
        <div className="relative">
          <Input
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={onToggleDropdown}
            onBlur={() => {
              setTimeout(onCloseDropdown, 200);
            }}
            placeholder="名前を入力 or 選択..."
            className="pr-8"
          />
          {sample.speaker && (
            <UserCheck className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          )}
        </div>

        {/* Dropdown */}
        {isDropdownOpen && filteredAttendees.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredAttendees.map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(name)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
