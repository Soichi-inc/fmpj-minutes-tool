"use client";

import { useState } from "react";
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
} from "lucide-react";

interface MinutesViewerProps {
  content: string;
  onReset: () => void;
}

export function MinutesViewer({ content, onReset }: MinutesViewerProps) {
  const { minutesContent, todoContent } = splitContent(content);
  const [copiedMinutes, setCopiedMinutes] = useState(false);
  const [copiedTodo, setCopiedTodo] = useState(false);

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
      // Fallback
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

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={downloadMarkdown}>
          <Download className="mr-2 h-4 w-4" />
          Markdownでダウンロード
        </Button>
        <Button variant="outline" size="sm" onClick={onReset}>
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
  // Look for the ToDo section heading
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

  // Fallback: try to find a markdown table near the end
  const tablePattern = /\|\s*No\.\s*\|/i;
  const tableMatch = content.match(tablePattern);
  if (tableMatch && tableMatch.index !== undefined) {
    // Find the heading before the table
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
