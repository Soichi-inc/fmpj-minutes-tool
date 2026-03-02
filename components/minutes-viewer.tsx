"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Download,
  Check,
  RotateCcw,
  FileText,
  ListTodo,
  Loader2,
} from "lucide-react";

interface MinutesViewerProps {
  content: string;
  onReset: () => void;
}

export function MinutesViewer({ content, onReset }: MinutesViewerProps) {
  const { minutesContent, todoContent } = splitContent(content);
  const [copiedMinutes, setCopiedMinutes] = useState(false);
  const [copiedTodo, setCopiedTodo] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = async (text: string, type: "minutes" | "todo") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "minutes") {
        setCopiedMinutes(true);
        setTimeout(() => setCopiedMinutes(false), 2000);
      } else {
        setCopiedTodo(true);
        setTimeout(() => setCopiedTodo(false), 2000);
      }
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `議事録_${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadDocx = async () => {
    setExporting("docx");
    try {
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          fileName: `議事録_${new Date().toISOString().split("T")[0]}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Word出力に失敗しました");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `議事録_${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Word出力に失敗しました"
      );
    } finally {
      setExporting(null);
    }
  };

  const downloadPdf = async () => {
    setExporting("pdf");
    try {
      // Dynamic import html2pdf.js (client-side only)
      const html2pdf = (await import("html2pdf.js")).default;

      const element = printRef.current;
      if (!element) throw new Error("印刷要素が見つかりません");

      const opt = {
        margin: [15, 15, 15, 15],
        filename: `議事録_${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      alert(err instanceof Error ? err.message : "PDF出力に失敗しました");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={downloadDocx}
          disabled={exporting !== null}
        >
          {exporting === "docx" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Word
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadPdf}
          disabled={exporting !== null}
        >
          {exporting === "pdf" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={downloadMarkdown}>
          <Download className="mr-2 h-4 w-4" />
          Markdown
        </Button>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          最初からやり直す
        </Button>
      </div>

      {/* Printable content (used by PDF export) */}
      <div ref={printRef}>
        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Minutes column */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
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
            <div className="border rounded-lg p-6 bg-white prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {minutesContent}
              </ReactMarkdown>
            </div>
          </div>

          {/* Todo column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
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
            <div className="border rounded-lg p-6 bg-white prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-td:text-foreground prose-th:text-foreground">
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
