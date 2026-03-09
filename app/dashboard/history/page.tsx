"use client";

import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getMinutesRecords,
  deleteMinutesRecord,
} from "@/lib/store/storage";
import { MinutesRecord, DEFAULT_MEETING_TYPES } from "@/lib/store/types";
import {
  Trash2,
  Copy,
  Download,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  FileText,
  Printer,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadAsWord, downloadAsPdf } from "@/lib/export-utils";

export default function HistoryPage() {
  const [records, setRecords] = useState<MinutesRecord[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    setRecords(getMinutesRecords());
  }, []);

  const meetingTypes = useMemo(() => {
    const types = new Set(records.map((r) => r.meetingType));
    return Array.from(types).sort();
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filterType && r.meetingType !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.meetingName.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.attendees.some((a) => a.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [records, filterType, searchQuery]);

  const handleDelete = (id: string) => {
    if (!confirm("この議事録を削除しますか？")) return;
    deleteMinutesRecord(id);
    setRecords(getMinutesRecords());
    if (expandedId === id) setExpandedId(null);
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadMd = (record: MinutesRecord) => {
    const blob = new Blob([record.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.meetingName}_${record.date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadWord = async (record: MinutesRecord) => {
    setExportingId(record.id);
    try {
      await downloadAsWord(
        record.content,
        `${record.meetingName}_${record.date}`
      );
    } catch {
      alert("Word出力に失敗しました");
    } finally {
      setExportingId(null);
    }
  };

  const handleDownloadPdf = async (record: MinutesRecord) => {
    setExportingId(record.id);
    try {
      await downloadAsPdf(
        record.content,
        `${record.meetingName}_${record.date}`
      );
    } catch {
      alert("PDF出力に失敗しました");
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">過去の議事録</h2>
        <p className="text-sm text-muted-foreground mt-1">
          生成した議事録の一覧です。ブラウザのローカルストレージに保存されています。
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="会議名・内容・出席者で検索..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant={filterType === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("")}
            className={`rounded-full press-effect ${filterType === "" ? "shadow-premium-sm" : ""}`}
          >
            すべて
          </Button>
          {(meetingTypes.length > 0
            ? meetingTypes
            : DEFAULT_MEETING_TYPES.slice(0, 4)
          ).map((type) => (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setFilterType(filterType === type ? "" : type)
              }
              className={`rounded-full press-effect ${filterType === type ? "shadow-premium-sm" : ""}`}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Records list */}
      {filtered.length === 0 ? (
        <Card className="rounded-xl shadow-premium-xs">
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {records.length === 0
                ? "まだ議事録が生成されていません"
                : "条件に一致する議事録がありません"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => {
            const isExpanded = expandedId === record.id;
            const isExporting = exportingId === record.id;
            return (
              <Card key={record.id} className="rounded-xl shadow-premium-xs hover-lift">
                <CardContent className="py-4">
                  {/* Summary row */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : record.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {record.meetingName}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {record.meetingType}
                          </Badge>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span>{record.date}</span>
                          {record.location && <span>{record.location}</span>}
                          <span>出席者: {record.attendees.length}名</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(record.content, record.id);
                        }}
                        title="コピー"
                      >
                        {copiedId === record.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Download dropdown */}
                      <div className="relative group">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                          title="ダウンロード"
                          disabled={isExporting}
                        >
                          {isExporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-premium-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[140px]">
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadWord(record);
                            }}
                            disabled={isExporting}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Word (.doc)
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPdf(record);
                            }}
                            disabled={isExporting}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            PDF（印刷）
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadMd(record);
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Markdown (.md)
                          </button>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(record.id);
                        }}
                        title="削除"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <>
                      <Separator className="my-4" />
                      <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-td:text-foreground prose-th:text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {record.content}
                        </ReactMarkdown>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
