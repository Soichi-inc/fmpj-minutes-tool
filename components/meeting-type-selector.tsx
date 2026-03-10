"use client";

import { useState } from "react";
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
  // Derive selectedId from the current value prop
  const preset = PRESET_TYPES.find((t) => t.id !== "custom" && t.label === value);
  const selectedId = preset ? preset.id : value ? "custom" : "";

  // Track custom input text separately
  const [customInput, setCustomInput] = useState(() => {
    return preset ? "" : value;
  });

  const handleSelect = (id: string) => {
    if (id === "custom") {
      onChange(customInput);
    } else {
      const selected = PRESET_TYPES.find((t) => t.id === id);
      if (selected) onChange(selected.label);
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
          value={customInput}
          onChange={(e) => {
            setCustomInput(e.target.value);
            onChange(e.target.value);
          }}
        />
      )}
    </div>
  );
}
