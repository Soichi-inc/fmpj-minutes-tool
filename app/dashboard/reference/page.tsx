"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Trash2,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { SUPPORTED_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/file-constants";

interface ReferenceFile {
  id: string;
  fileName: string;
  fileSize: number;
  textLength: number;
  uploadedAt: string;
  url: string;
}

export default function ReferencePage() {
  const [references, setReferences] = useState<ReferenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReferences = useCallback(async () => {
    try {
      const res = await fetch("/api/reference/list");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "取得に失敗しました");
      }
      const data = await res.json();
      setReferences(data.references);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "参考資料の取得に失敗しました";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError("");
    setSuccess("");
    setUploading(true);

    let successCount = 0;
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      // Validate extension
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        errors.push(`${file.name}: 未対応のファイル形式`);
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: ファイルサイズが上限（10MB）を超えています`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/reference/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          errors.push(`${file.name}: ${data.error}`);
        } else {
          successCount++;
        }
      } catch {
        errors.push(`${file.name}: アップロードに失敗しました`);
      }
    }

    if (successCount > 0) {
      setSuccess(`${successCount}件のファイルをアップロードしました`);
      fetchReferences();
    }
    if (errors.length > 0) {
      setError(errors.join("\n"));
    }

    setUploading(false);
    // Reset file input
    e.target.value = "";
  };

  const handleDelete = async (ref: ReferenceFile) => {
    if (!confirm(`「${ref.fileName}」を削除しますか？`)) return;

    setDeletingId(ref.id);
    setError("");

    try {
      const res = await fetch(`/api/reference/${ref.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setReferences((prev) => prev.filter((r) => r.id !== ref.id));
      setSuccess(`「${ref.fileName}」を削除しました`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "削除に失敗しました";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">参考資料管理</h2>
          <p className="text-sm text-muted-foreground mt-1">
            議事録生成時に参照する資料（議案書、報告書等）をアップロードできます。
          </p>
        </div>

        <div className="relative">
          <input
            type="file"
            multiple
            accept={SUPPORTED_EXTENSIONS.join(",")}
            onChange={handleUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          <Button disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                アップロード中...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                ファイルをアップロード
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        対応形式: {SUPPORTED_EXTENSIONS.join(", ")}　最大サイズ: 10MB
      </p>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">読み込み中...</p>
        </div>
      ) : references.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">参考資料がまだありません</p>
          <p className="text-sm text-muted-foreground mt-1">
            議案書やレジュメをアップロードすると、議事録生成時に参照できます
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {ref.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(ref.fileSize)} ・ 抽出テキスト:{" "}
                    {ref.textLength.toLocaleString()}文字 ・{" "}
                    {formatDate(ref.uploadedAt)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(ref)}
                disabled={deletingId === ref.id}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                {deletingId === ref.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
