"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import {
  DetectedSpeaker,
  detectSpeakers,
} from "@/lib/utils/speaker-detector";

interface SpeakerMappingProps {
  transcript: string;
  attendees: string[];
  onBack: () => void;
  onConfirm: (mapping: Record<string, string>) => void;
}

export function SpeakerMapping({
  transcript,
  attendees,
  onBack,
  onConfirm,
}: SpeakerMappingProps) {
  const speakers = useMemo(() => detectSpeakers(transcript), [transcript]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Initialize mapping with empty values
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const speaker of speakers) {
      initial[speaker.label] = "";
    }
    setMapping(initial);
  }, [speakers]);

  const updateMapping = (speakerLabel: string, name: string) => {
    setMapping((prev) => ({ ...prev, [speakerLabel]: name }));
  };

  const allMapped = speakers.every(
    (s) => mapping[s.label]?.trim().length > 0
  );

  const handleConfirm = () => {
    onConfirm(mapping);
  };

  if (speakers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            話者ラベルが検出されませんでした
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            文字起こしデータに &quot;Speaker 1&quot; や &quot;話者
            1&quot; 等のラベルが見つかりませんでした。
            そのまま議事録を生成します。
          </p>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            戻る
          </Button>
          <Button onClick={() => onConfirm({})}>
            議事録を生成する
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-1">話者の特定</h3>
        <p className="text-sm text-muted-foreground">
          検出された話者ラベルに対して実名を入力してください。
          出席者リストから候補をクリックで入力できます。
        </p>
      </div>

      {attendees.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">出席者候補</Label>
          <div className="flex flex-wrap gap-2">
            {attendees.map((name) => (
              <AttendeeChip key={name} name={name} mapping={mapping} onSelect={(speakerLabel) => updateMapping(speakerLabel, name)} speakers={speakers} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {speakers.map((speaker) => (
          <SpeakerRow
            key={speaker.id}
            speaker={speaker}
            value={mapping[speaker.label] || ""}
            onChange={(name) => updateMapping(speaker.label, name)}
            attendees={attendees}
          />
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
        <Button onClick={handleConfirm} disabled={!allMapped}>
          議事録を生成する
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SpeakerRow({
  speaker,
  value,
  onChange,
  attendees,
}: {
  speaker: DetectedSpeaker;
  value: string;
  onChange: (name: string) => void;
  attendees: string[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filtered = attendees.filter(
    (a) => value && a.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card">
      <div className="min-w-[140px]">
        <span className="font-medium">{speaker.label}</span>
        <span className="text-xs text-muted-foreground ml-2">
          ({speaker.count}回発言)
        </span>
      </div>
      <div className="flex-1 relative">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="実名を入力..."
        />
        {showSuggestions && filtered.length > 0 && value && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md">
            {filtered.map((name) => (
              <button
                key={name}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  setShowSuggestions(false);
                }}
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

function AttendeeChip({
  name,
  mapping,
  onSelect,
  speakers,
}: {
  name: string;
  mapping: Record<string, string>;
  onSelect: (speakerLabel: string) => void;
  speakers: DetectedSpeaker[];
}) {
  const isUsed = Object.values(mapping).includes(name);
  // Find first unmapped speaker
  const firstUnmapped = speakers.find(
    (s) => !mapping[s.label]?.trim()
  );

  return (
    <Badge
      variant={isUsed ? "secondary" : "outline"}
      className={`cursor-pointer transition-colors ${
        isUsed ? "opacity-50" : "hover:bg-primary hover:text-primary-foreground"
      }`}
      onClick={() => {
        if (!isUsed && firstUnmapped) {
          onSelect(firstUnmapped.label);
        }
      }}
    >
      {name}
      {isUsed && " ✓"}
    </Badge>
  );
}
