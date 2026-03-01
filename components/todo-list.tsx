"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TodoListProps {
  content: string;
}

export function TodoList({ content }: TodoListProps) {
  if (!content) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>ToDoリストは検出されませんでした</p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none prose-td:text-foreground prose-th:text-foreground prose-th:font-medium">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
