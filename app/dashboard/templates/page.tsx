"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getTemplates,
  saveTemplate,
  deleteTemplate,
} from "@/lib/store/storage";
import {
  FormatTemplate,
  DEFAULT_MEETING_TYPES,
} from "@/lib/store/types";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";

function emptyTemplate(): FormatTemplate {
  return {
    id: crypto.randomUUID(),
    name: "",
    meetingType: "",
    description: "",
    formatInstructions: "",
    sampleOutput: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<FormatTemplate[]>([]);
  const [editing, setEditing] = useState<FormatTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  const handleNew = () => {
    setEditing(emptyTemplate());
    setIsNew(true);
  };

  const handleEdit = (template: FormatTemplate) => {
    setEditing({ ...template });
    setIsNew(false);
  };

  const handleSave = () => {
    if (!editing || !editing.name.trim()) return;
    saveTemplate(editing);
    setTemplates(getTemplates());
    setEditing(null);
    setIsNew(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("このテンプレートを削除しますか？")) return;
    deleteTemplate(id);
    setTemplates(getTemplates());
    if (editing?.id === id) {
      setEditing(null);
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setIsNew(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">フォーマットテンプレート</h2>
          <p className="text-sm text-muted-foreground mt-1">
            会議種別ごとに議事録の出力フォーマットを事前に設定できます。
            過去の議事録をサンプルとして登録すると、同じ文体で生成されます。
          </p>
        </div>
        {!editing && (
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            新規テンプレート
          </Button>
        )}
      </div>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isNew ? "新規テンプレート作成" : "テンプレート編集"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">
                  テンプレート名 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tpl-name"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="例: 理事会議事録フォーマット"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-type">会議種別</Label>
                <select
                  id="tpl-type"
                  value={editing.meetingType}
                  onChange={(e) =>
                    setEditing({ ...editing, meetingType: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">選択してください</option>
                  {DEFAULT_MEETING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-desc">説明</Label>
                <Input
                  id="tpl-desc"
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  placeholder="テンプレートの簡単な説明"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-format">
                フォーマット指示（追加の出力ルール）
              </Label>
              <Textarea
                id="tpl-format"
                value={editing.formatInstructions}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    formatInstructions: e.target.value,
                  })
                }
                placeholder={`例:\n- 各議題の冒頭に「【議題○】」と記載すること\n- 決議事項には賛成・反対の票数を記載すること\n- 報告事項と審議事項を明確に分けること`}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                デフォルトのFMPJフォーマットに追加して適用されるルールを記載してください
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-sample">
                過去の議事録サンプル（参考文体）
              </Label>
              <Textarea
                id="tpl-sample"
                value={editing.sampleOutput}
                onChange={(e) =>
                  setEditing({ ...editing, sampleOutput: e.target.value })
                }
                placeholder="過去に作成した議事録のテキストを貼り付けると、同じ文体・構成で生成されます"
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                過去の議事録を貼り付けると、文体・構成のfew-shot
                exampleとして活用されます
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                キャンセル
              </Button>
              <Button
                onClick={handleSave}
                disabled={!editing.name.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                保存
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              テンプレートがまだ登録されていません
            </p>
            <Button variant="outline" onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              最初のテンプレートを作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{template.name}</h3>
                      {template.meetingType && (
                        <Badge variant="secondary">
                          {template.meetingType}
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                      {template.formatInstructions && (
                        <span>
                          フォーマット指示: {template.formatInstructions.length}
                          文字
                        </span>
                      )}
                      {template.sampleOutput && (
                        <span>
                          サンプル: {template.sampleOutput.length}文字
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
