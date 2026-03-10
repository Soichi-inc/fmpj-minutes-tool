import { getAnthropicClient } from "@/lib/anthropic";
import { TermEntry } from "@/lib/store/types";

/**
 * 議事録テキストから固有名詞・専門用語を抽出する。
 * Claude Haiku を使用して高速に処理。
 */
export async function extractTerminology(
  minutesText: string
): Promise<TermEntry[]> {
  if (!minutesText.trim()) return [];

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `あなたは日本語の議事録から固有名詞・専門用語を抽出する専門家です。
以下のカテゴリに該当する語句をJSON配列で出力してください。

カテゴリ:
- 人名: 個人名（姓名）
- 組織名: 会社名、団体名、委員会名など
- プロジェクト名: プロジェクト、イベント、キャンペーン名など
- 専門用語: 業界固有の専門用語、略称、法律名など
- その他: 上記に該当しない固有名詞（地名、施設名など）

出力形式（JSON配列のみ、他のテキストは不要）:
[{"term":"田中太郎","reading":"たなかたろう","category":"人名"},{"term":"FMPJ","category":"組織名"}]

注意:
- 一般的な日本語の単語は含めない（会議、報告、承認など）
- 読み仮名(reading)は人名・組織名で推測可能な場合のみ付与
- 重複は排除する
- 最大50件まで`,
    messages: [
      {
        role: "user",
        content: `以下の議事録テキストから固有名詞・専門用語を抽出してください。\n\n${minutesText.slice(0, 8000)}`,
      },
    ],
  });

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON array from response (may have surrounding text)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      term: string;
      reading?: string;
      category: string;
    }>;

    return parsed
      .filter((item) => item.term && item.category)
      .map((item) => ({
        term: item.term,
        reading: item.reading || undefined,
        category: item.category,
      }));
  } catch {
    // パース失敗時は空配列を返す
    return [];
  }
}
