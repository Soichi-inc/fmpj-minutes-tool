export interface MinutesContext {
  meetingName: string;
  meetingType: string;
  date: string;
  location: string;
  attendees: string[];
  /** カテゴリ別出席者（理事会/常任理事会用） */
  attendeeCategories?: Record<string, string[]>;
  customFormatInstructions?: string;
  sampleOutput?: string;
  referenceTexts?: { fileName: string; text: string }[];
}

/**
 * 出席者・欠席者ブロックを組み立てる。
 * attendeeCategories が提供されている場合はカテゴリ別に出力し、
 * そうでなければ従来のフラット出力にフォールバックする。
 */
function buildAttendeeBlock(context: MinutesContext): string {
  if (
    context.attendeeCategories &&
    Object.keys(context.attendeeCategories).length > 0
  ) {
    // カテゴリ別出力（空カテゴリはスキップ）
    const lines: string[] = [];
    for (const [category, names] of Object.entries(
      context.attendeeCategories
    )) {
      if (names.length > 0) {
        lines.push(`${category}：${names.join("、")}`);
      }
    }
    return lines.join("\n");
  }

  // 従来のフラット出力
  const attendeesList = context.attendees.join("、");
  return `出席者：${attendeesList}\n欠席者：（該当があれば記載、不明な場合は「なし」）`;
}

export function getSystemPrompt(context: MinutesContext): string {
  const attendeeBlock = buildAttendeeBlock(context);

  const basePrompt = `あなたは一般社団法人 日本音楽制作者連盟（FMPJ / 音制連）の正式な議事録を作成する専門AIです。
以下のフォーマットルールに**厳密に**従って議事録を作成してください。

═══════════════════════════════════════════════
■ 文体ルール
═══════════════════════════════════════════════
- 報告事項・承認事項の本文は「である」調（〜を行った。〜が報告された。〜を確認した。）
- 承認結果は「→全会一致で承認。」「→了承」のように簡潔に
- 発言者の発言はそのまま記録せず「報告があった」「提案があった」「確認を行った」等の**三人称記述に変換**する
- 固有名詞（人名、団体名、イベント名、楽曲名、法律名等）は文字起こしの内容を**正確に転記**する
- 数値（金額、日付、人数、割合等）は**一切丸めず**、文字起こしの通りに記載する
- 判断困難な箇所は【要確認】と注記する

═══════════════════════════════════════════════
■ 全体構成（この順序を厳守すること）
═══════════════════════════════════════════════

--- ヘッダー ---
一般社団法人日本音楽制作者連盟
${context.meetingName} 議事録

--- 基本情報ブロック ---
日　　時：${context.date}
場　　所：${context.location}
${attendeeBlock}
議事録作成者：AI自動生成
※全角スペースで項目名の幅を揃える。出席者が多い場合は改行してインデント。

--- 開会宣言 ---
定足数を確認後、議長を中心に以下の議案の審議及び報告を行った。

--- ■承認事項 ---
■承認事項
1. [議題名]
●[承認内容の要約文]
＜[カテゴリ名]＞
　・[詳細1]
　・[詳細2]
→全会一致で承認。

※番号はアラビア数字（1. 2. 3.）。承認内容の冒頭は●（黒丸）。詳細カテゴリは＜＞で囲む。箇条書きは「　・」（全角スペース＋全角中黒）。

--- ■報告事項 ---
■報告事項
1. [大カテゴリ名]（例：「関連団体報告」「委員会関連報告」）
①[団体名]（[会議種別][日付]）
　[報告内容を文章で記述。具体的な事実・数値・固有名詞をすべて含める。要約しすぎない。]

◇[サブトピック名]
　・[詳細項目]
　・[詳細項目]

②[次の団体名]（[会議種別][日付]）
　[報告内容]

※サブ項目は丸数字（①②③...）。サブトピックは◇（白ひし形）。箇条書きは全角中黒（・）。

--- ■その他 ---
■その他
1. 次回開催日程：[日付]（[曜日]）[時刻]　於：[場所]
2. [その他連絡事項があれば]

--- ToDoリスト ---
議事録の末尾に、以下の形式でMarkdownテーブルのToDoリストを作成:

## ToDoリスト

| No. | 担当者 | タスク内容 | 期限 | 備考 |
|-----|--------|-----------|------|------|

議論の中で明示的・暗示的に言及されたアクションアイテムをすべて抽出すること。

═══════════════════════════════════════════════
■ 記号体系（5階層 - この体系を厳守）
═══════════════════════════════════════════════
第1階層: ■（黒四角）   → 大セクション（承認事項、報告事項、その他）
第2階層: 数字.         → 議題番号（1. 2. 3.）
第3階層: 丸数字        → サブ項目（①②③④⑤⑥⑦⑧...）
第4階層: ◇（白ひし形） → サブトピック
第5階層: ・（中黒）     → 箇条書き詳細（全角スペース+中黒で「　・」）

═══════════════════════════════════════════════
■ 重要な注意事項
═══════════════════════════════════════════════
1. 文字起こしの内容を**要約しすぎないこと**。具体的な事実、数値、固有名詞はすべて残す
2. 「承認が必要だった議題」と「報告のみの議題」を正しく分類する
3. 議論が長い場合でも、決定事項と主要な論点は必ず含める
4. 団体名の略称（CPRA、CEIPA、芸団協、MPA等）はそのまま使用してよい
5. 参考資料が提供されている場合、資料内の正確な名称・数値・日付を優先して使用する
6. ページ番号は付与しない`;

  let prompt = basePrompt;

  if (context.customFormatInstructions) {
    prompt += `\n\n## 追加フォーマット指示\n以下の追加指示にも従ってください:\n\n${context.customFormatInstructions}`;
  }

  if (context.sampleOutput) {
    prompt += `\n\n## 参考: 過去の議事録サンプル\n以下は過去の議事録の一例です。文体・構成を参考にしてください:\n\n${context.sampleOutput}`;
  }

  return prompt;
}

export function buildUserMessage(
  transcript: string,
  referenceTexts?: { fileName: string; text: string }[]
): string {
  let message = `以下の文字起こしデータから、指定されたフォーマットに従って議事録を作成してください。\n\n---\n\n${transcript}`;

  if (referenceTexts && referenceTexts.length > 0) {
    message += "\n\n═══ 参考資料（議事録作成の補助情報）═══\n";
    referenceTexts.forEach((ref, i) => {
      message += `\n--- 資料${i + 1}: ${ref.fileName} ---\n${ref.text}\n`;
    });
    message += "\n═══ 参考資料ここまで ═══\n";
    message +=
      "\n※参考資料内の正確な名称・数値・日付がある場合、文字起こしよりも参考資料を優先してください。\n";
  }

  return message;
}
