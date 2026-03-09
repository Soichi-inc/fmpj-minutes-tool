"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESET_TYPES = [
  { id: "board", label: "理事会" },
  { id: "executive", label: "常任理事会" },
  { id: "custom", label: "その他（手入力）" },
];

interface MeetingTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MeetingTypeSelector({
  value,
  onChange,
}: MeetingTypeSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(() => {
    const preset = PRESET_TYPES.find((t) => t.id !== "custom" && t.label === value);
    if (preset) return preset.id;
    if (value) return "custom";
    return "";
  });
  const [customValue, setCustomValue] = useState(() => {
    const isPreset = PRESET_TYPES.some((t) => t.id !== "custom" && t.label === value);
    return isPreset ? "" : value;
  });

  // Sync external value changes
  useEffect(() => {
    const preset = PRESET_TYPES.find((t) => t.id !== "custom" && t.label === value);
    if (preset) {
      setSelectedId(preset.id);
      setCustomValue("");
    } else if (value && selectedId !== "custom") {
      setSelectedId("custom");
      setCustomValue(value);
    }
  }, [value, selectedId]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (id === "custom") {
      onChange(customValue);
    } else {
      const preset = PRESET_TYPES.find((t) => t.id === id);
      if (preset) onChange(preset.label);
    }
  };

  return (
    <div className="space-y-2">
      <Label>
        会議種別 <span className="text-destructive">*</span>
      </Label>
      <div className="flex gap-2">
        {PRESET_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => handleSelect(type.id)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all press-effect ${
              selectedId === type.id
                ? "bg-primary text-primary-foreground border-primary shadow-premium-sm"
                : "bg-card text-foreground border-input hover:border-primary/50"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>
      {selectedId === "custom" && (
        <Input
          placeholder="例: 著作権委員会、総会、実演家部会..."
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            onChange(e.target.value);
          }}
        />
      )}
    </div>
  );
}
