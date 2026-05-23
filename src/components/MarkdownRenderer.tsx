'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';

const MarkdownRenderer = memo(function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown>
      {content}
    </ReactMarkdown>
  );
});

export default MarkdownRenderer;