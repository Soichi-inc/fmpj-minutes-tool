"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** 理事会の出席者カテゴリ（8タブ） */
const BOARD_CATEGORIES = [
  "出席理事",
  "欠席理事",
  "出席監事",
  "欠席監事",
  "出席相談役",
  "欠席相談役",
  "出席顧問弁護士",
  "欠席顧問弁護士",
];

/** 常任理事会の出席者カテゴリ（1タブ） */
const EXECUTIVE_CATEGORIES = ["出席理事"];

interface AttendeeInputProps {
  meetingType: string;
  /** カテゴリ別データ（キー: カテゴリ名, 値: 改行区切り文字列） */
  categories: Record<string, string>;
  onCategoriesChange: (categories: Record<string, string>) => void;
  /** その他用のフリーテキスト */
  freeText: string;
  onFreeTextChange: (text: string) => void;
}

export function AttendeeInput({
  meetingType,
  categories,
  onCategoriesChange,
  freeText,
  onFreeTextChange,
}: AttendeeInputProps) {
  const [activeTab, setActiveTab] = useState(0);

  // 会議種別に応じたカテゴリ一覧
  const tabCategories =
    meetingType === "理事会"
      ? BOARD_CATEGORIES
      : meetingType === "常任理事会"
        ? EXECUTIVE_CATEGORIES
        : null; // null = フリーテキストモード

  // 会議種別変更時に最初のタブにリセット
  useEffect(() => {
    setActiveTab(0);
  }, [meetingType]);

  // フリーテキストモード（その他の会議種別）
  if (!tabCategories) {
    return (
      <div className="space-y-2">
        <Label htmlFor="attendees">出席者（改行区切り）</Label>
        <Textarea
          id="attendees"
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
          placeholder={"山田太郎\n佐藤花子\n田中一郎"}
          rows={3}
        />
      </div>
    );
  }

  const handleCategoryChange = (category: string, value: string) => {
    onCategoriesChange({ ...categories, [category]: value });
  };

  const activeCategory = tabCategories[activeTab] || tabCategories[0];

  // 入力済みカテゴリの数を取得
  const filledCount = (cat: string) => {
    const val = categories[cat]?.trim();
    if (!val) return 0;
    return val.split("\n").filter((s) => s.trim()).length;
  };

  return (
    <div className="space-y-2">
      <Label>出席者・欠席者</Label>

      {/* タブ一覧 */}
      <div className="flex flex-wrap gap-1">
        {tabCategories.map((cat, i) => {
          const count = filledCount(cat);
          const isActive = i === activeTab;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`
                px-3 py-1.5 text-xs rounded-md border transition-all press-effect
                ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-premium-xs"
                    : "bg-card hover:bg-accent border-input"
                }
              `}
            >
              {cat}
              {count > 0 && (
                <span
                  className={`ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-medium ${
                    isActive
                      ? "bg-primary-foreground text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* アクティブタブのテキストエリア */}
      <Textarea
        value={categories[activeCategory] || ""}
        onChange={(e) => handleCategoryChange(activeCategory, e.target.value)}
        placeholder={`${activeCategory}の氏名を改行区切りで入力\n例:\n山田太郎\n佐藤花子`}
        rows={4}
      />
      <p className="text-xs text-muted-foreground">
        空欄のカテゴリは議事録に反映されません
      </p>
    </div>
  );
}

export { BOARD_CATEGORIES, EXECUTIVE_CATEGORIES };
