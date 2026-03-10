"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Users, X } from "lucide-react";
import {
  DetectedSpeaker,
  detectSpeakers,
} from "@/lib/utils/speaker-detector";
import { SpeakerEntry } from "@/lib/store/types";

interface SpeakerMappingProps {
  transcript: string;
  attendees: string[];
  onBack: () => void;
  onConfirm: (
    mapping: Record<string, SpeakerEntry>,
    excludedLabels: string[]
  ) => void;
}

export function SpeakerMapping({
  transcript,
  attendees,
  onBack,
  onConfirm,
}: SpeakerMappingProps) {
  const speakers = useMemo(() => detectSpeakers(transcript), [transcript]);

  // Initial state is computed from speakers; parent should use key={transcript}
  // to force remount when transcript changes
  const [mapping, setMapping] = useState<Record<string, SpeakerEntry>>(() => {
    const initial: Record<string, SpeakerEntry> = {};
    for (const speaker of speakers) {
      initial[speaker.label] = { name: "", title: "" };
    }
    return initial;
  });
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});

  const updateName = (speakerLabel: string, name: string) => {
    setMapping((prev) => ({
      ...prev,
      [speakerLabel]: { ...prev[speakerLabel], name },
    }));
  };

  const updateTitle = (speakerLabel: string, title: string) => {
    setMapping((prev) => ({
      ...prev,
      [speakerLabel]: { ...prev[speakerLabel], title },
    }));
  };

  const toggleExclude = (speakerLabel: string) => {
    setExcluded((prev) => ({
      ...prev,
      [speakerLabel]: !prev[speakerLabel],
    }));
  };

  // Only require names for non-excluded speakers
  const allMapped = speakers.every(
    (s) => excluded[s.label] || mapping[s.label]?.name?.trim().length > 0
  );

  const excludedSpeakers = speakers.filter((s) => excluded[s.label]);

  const handleConfirm = () => {
    const excludedLabels = speakers
      .filter((s) => excluded[s.label])
      .map((s) => s.label);
    onConfirm(mapping, excludedLabels);
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
          <Button variant="outline" onClick={onBack} className="press-effect">
            <ArrowLeft className="mr-2 h-4 w-4" />
            戻る
          </Button>
          <Button
            onClick={() => onConfirm({}, [])}
            className="bg-gradient-primary hover:opacity-90 press-effect shadow-premium-md"
          >
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
              <AttendeeChip key={name} name={name} mapping={mapping} onSelect={(speakerLabel) => updateName(speakerLabel, name)} speakers={speakers} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {speakers.map((speaker) => (
          <SpeakerRow
            key={speaker.id}
            speaker={speaker}
            nameValue={mapping[speaker.label]?.name || ""}
            titleValue={mapping[speaker.label]?.title || ""}
            onNameChange={(name) => updateName(speaker.label, name)}
            onTitleChange={(title) => updateTitle(speaker.label, title)}
            attendees={attendees}
            isExcluded={!!excluded[speaker.label]}
            onToggleExclude={() => toggleExclude(speaker.label)}
          />
        ))}
      </div>

      {excludedSpeakers.length > 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <span className="font-medium">除外中:</span>{" "}
          {excludedSpeakers.map((s) => s.label).join("、")}
          （{excludedSpeakers.reduce((sum, s) => sum + s.count, 0)}
          件の発言が除外されます）
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="press-effect">
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!allMapped}
          className="bg-gradient-primary hover:opacity-90 press-effect shadow-premium-md"
        >
          議事録を生成する
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SpeakerRow({
  speaker,
  nameValue,
  titleValue,
  onNameChange,
  onTitleChange,
  attendees,
  isExcluded,
  onToggleExclude,
}: {
  speaker: DetectedSpeaker;
  nameValue: string;
  titleValue: string;
  onNameChange: (name: string) => void;
  onTitleChange: (title: string) => void;
  attendees: string[];
  isExcluded: boolean;
  onToggleExclude: () => void;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filtered = attendees.filter(
    (a) => nameValue && a.toLowerCase().includes(nameValue.toLowerCase())
  );

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isExcluded
          ? "bg-muted/50 border-dashed opacity-60"
          : "bg-card shadow-premium-xs hover:shadow-premium-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0 mr-3">
          <div>
            <span className={`font-medium ${isExcluded ? "line-through" : ""}`}>
              {speaker.label}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              ({speaker.count}回発言)
            </span>
          </div>
          {speaker.firstUtterance && (
            <p className="text-xs text-muted-foreground mt-1 truncate" title={speaker.firstUtterance}>
              「{speaker.firstUtterance}」
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleExclude}
          className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-all press-effect ${
            isExcluded
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "bg-card text-muted-foreground border-input hover:border-destructive hover:text-destructive"
          }`}
          title={isExcluded ? "除外を解除" : "この話者を除外"}
        >
          {isExcluded ? "除外を解除" : (
            <>
              <X className="inline h-3 w-3 mr-1" />
              除外
            </>
          )}
        </button>
      </div>

      {isExcluded ? (
        <div className="text-sm text-muted-foreground italic">
          この話者の発言は議事録から除外されます
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Label className="text-xs text-muted-foreground mb-1 block">名前</Label>
            <Input
              value={nameValue}
              onChange={(e) => {
                onNameChange(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="実名を入力..."
            />
            {showSuggestions && filtered.length > 0 && nameValue && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md">
                {filtered.map((name) => (
                  <button
                    key={name}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onNameChange(name);
                      setShowSuggestions(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-48">
            <Label className="text-xs text-muted-foreground mb-1 block">肩書き</Label>
            <Input
              value={titleValue}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="例: 事務局長"
            />
          </div>
        </div>
      )}
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
  mapping: Record<string, SpeakerEntry>;
  onSelect: (speakerLabel: string) => void;
  speakers: DetectedSpeaker[];
}) {
  const isUsed = Object.values(mapping).some((entry) => entry.name === name);
  // Find first unmapped speaker
  const firstUnmapped = speakers.find(
    (s) => !mapping[s.label]?.name?.trim()
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
