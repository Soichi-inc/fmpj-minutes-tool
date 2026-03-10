"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Download,
  Check,
  RotateCcw,
  FileText,
  ListTodo,
  Loader2,
  Printer,
  BookOpen,
  Save,
  Pencil,
  X,
  CheckCircle2,
} from "lucide-react";
import { downloadAsWord, downloadAsPdf } from "@/lib/export-utils";

interface MinutesViewerProps {
  content: string;
  meetingType?: string;
  meetingName?: string;
  date?: string;
  onReset: () => void;
}

export function MinutesViewer({
  content,
  meetingType,
  meetingName,
  date,
  onReset,
}: MinutesViewerProps) {
  const { minutesContent, todoContent } = splitContent(content);
  const [copiedMinutes, setCopiedMinutes] = useState(false);
  const [copiedTodo, setCopiedTodo] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);

  // 確定版保存 states
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const baseName = `議事録_${new Date().toISOString().split("T")[0]}`;

  const handleStartEditing = () => {
    setEditedContent(content);
    setIsEditing(true);
    setSaveSuccess(false);
    setSaveError("");
  };

  const handleSaveAsLearning = async () => {
    setIsSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/learning/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingType: meetingType || "その他",
          meetingName: meetingName || "",
          date: date || "",
          originalContent: content,
          finalContent: editedContent,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存に失敗しました");
      }
      setSaveSuccess(true);
      setIsEditing(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "保存に失敗しました"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text: string, type: "minutes" | "todo") => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers or non-HTTPS contexts
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
      } catch {
        // Copy failed silently
      }
      document.body.removeChild(textArea);
    }
    if (type === "minutes") {
      setCopiedMinutes(true);
      setTimeout(() => setCopiedMinutes(false), 2000);
    } else {
      setCopiedTodo(true);
      setTimeout(() => setCopiedTodo(false), 2000);
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleWordDownload = async () => {
    setExporting("docx");
    try {
      await downloadAsWord(content, baseName);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Word出力に失敗しました");
    } finally {
      setExporting(null);
    }
  };

  const handlePdfDownload = async () => {
    setExporting("pdf");
    try {
      await downloadAsPdf(content, baseName);
    } catch (err) {
      alert(err instanceof Error ? err.message : "PDF出力に失敗しました");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 justify-end bg-card rounded-xl border shadow-premium-xs p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleWordDownload}
          disabled={exporting !== null}
          className="press-effect"
        >
          {exporting === "docx" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Word (.docx)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePdfDownload}
          disabled={exporting !== null}
          className="press-effect"
        >
          {exporting === "pdf" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Printer className="mr-2 h-4 w-4" />
          )}
          PDF（印刷）
        </Button>
        <Button variant="outline" size="sm" onClick={downloadMarkdown} className="press-effect">
          <Download className="mr-2 h-4 w-4" />
          Markdown
        </Button>
        <Button variant="outline" size="sm" onClick={onReset} className="press-effect">
          <RotateCcw className="mr-2 h-4 w-4" />
          最初からやり直す
        </Button>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Minutes column */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
              議事録
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(minutesContent, "minutes")}
            >
              {copiedMinutes ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  コピー済み
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  コピー
                </>
              )}
            </Button>
          </div>
          <div className="border rounded-xl p-6 bg-card shadow-premium-xs prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {minutesContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* Todo column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                <ListTodo className="h-3.5 w-3.5 text-primary" />
              </div>
              ToDoリスト
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(todoContent, "todo")}
            >
              {copiedTodo ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  コピー済み
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  コピー
                </>
              )}
            </Button>
          </div>
          <div className="border rounded-xl p-6 bg-card shadow-premium-xs prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-td:text-foreground prose-th:text-foreground">
            {todoContent ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {todoContent}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground text-sm">
                ToDoリストは検出されませんでした
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* 学習データとして保存 */}
      <div className="space-y-3">
        {!isEditing && !saveSuccess && (
          <div className="border rounded-xl p-4 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  学習データとして保存
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI生成結果を編集して確定版として保存すると、次回以降の議事録生成の品質が向上します。
                </p>
              </div>
              <Button size="sm" onClick={handleStartEditing} className="press-effect">
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                編集して保存
              </Button>
            </div>
          </div>
        )}

        {isEditing && (
          <div className="border rounded-xl p-4 space-y-3 shadow-premium-xs">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                確定版を編集
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={20}
              className="font-mono text-sm"
            />
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAsLearning}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                確定版として保存
              </Button>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="border rounded-lg p-4 bg-green-50 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">
                学習データとして保存しました
              </p>
              <p className="text-xs text-green-600">
                次回の議事録生成時に参考データとして自動的に使用されます。
              </p>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Full markdown view (collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
          Markdownソースを表示
        </summary>
        <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono">
          {content}
        </pre>
      </details>
    </div>
  );
}

/**
 * Split the generated content into minutes body and todo section.
 */
function splitContent(content: string): {
  minutesContent: string;
  todoContent: string;
} {
  const todoPatterns = [
    /^###?\s*ToDo\s*リスト/im,
    /^###?\s*TODO\s*リスト/im,
    /^###?\s*ToDo\s*List/im,
    /^###?\s*アクションアイテム/im,
  ];

  for (const pattern of todoPatterns) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      return {
        minutesContent: content.slice(0, match.index).trim(),
        todoContent: content.slice(match.index).trim(),
      };
    }
  }

  const tablePattern = /\|\s*No\.\s*\|/i;
  const tableMatch = content.match(tablePattern);
  if (tableMatch && tableMatch.index !== undefined) {
    const beforeTable = content.slice(0, tableMatch.index);
    const lastHeading = beforeTable.lastIndexOf("\n#");
    if (lastHeading !== -1) {
      return {
        minutesContent: content.slice(0, lastHeading).trim(),
        todoContent: content.slice(lastHeading).trim(),
      };
    }
  }

  return { minutesContent: content, todoContent: "" };
}
