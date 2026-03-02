"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, FolderOpen } from "lucide-react";

interface ReferenceFile {
  id: string;
  fileName: string;
  fileSize: number;
  textLength: number;
  uploadedAt: string;
}

interface ReferenceSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ReferenceSelector({
  selectedIds,
  onChange,
}: ReferenceSelectorProps) {
  const [references, setReferences] = useState<ReferenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReferences = async () => {
      try {
        const res = await fetch("/api/reference/list");
        if (!res.ok) {
          // If Blob is not configured, silently fail
          setReferences([]);
          return;
        }
        const data = await res.json();
        setReferences(data.references || []);
      } catch {
        // Silently fail if reference API is unavailable
        setReferences([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReferences();
  }, []);

  const toggleReference = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  // Don't render anything if no references exist and not loading
  if (!loading && references.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <FolderOpen className="h-4 w-4" />
          参考資料
        </Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border border-dashed">
          <Loader2 className="h-4 w-4 animate-spin" />
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <FolderOpen className="h-4 w-4" />
        参考資料（議案書等を添付）
      </Label>
      <div className="rounded-lg border p-3 space-y-2 max-h-48 overflow-y-auto">
        {references.map((ref) => {
          const isSelected = selectedIds.includes(ref.id);
          return (
            <label
              key={ref.id}
              className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-accent border border-transparent"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleReference(ref.id)}
                className="rounded border-gray-300"
              />
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium truncate block">
                  {ref.fileName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ref.textLength.toLocaleString()}文字
                </span>
              </div>
            </label>
          );
        })}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length}件の資料が選択されています。議事録生成時にAIが参照します。
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
