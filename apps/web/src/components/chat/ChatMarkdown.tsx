import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
}

export const ChatMarkdown = ({ content }: Props) => (
  <div className="px-1 pt-1 text-[15.5px] leading-relaxed text-base-content text-start">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc ps-5 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ps-5 mb-2 space-y-1">{children}</ol>,
        h1: ({ children }) => <p className="font-bold text-[17px] mb-1.5">{children}</p>,
        h2: ({ children }) => <p className="font-bold text-[16px] mb-1.5">{children}</p>,
        h3: ({ children }) => <p className="font-bold mb-1">{children}</p>,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2 rounded-xl border border-base-200">
            <table className="table table-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="text-start text-[12px] text-base-content/60">{children}</th>
        ),
        td: ({ children }) => <td className="text-start tabular-nums">{children}</td>,
        code: ({ children }) => (
          <code className="bg-base-200/70 rounded px-1.5 py-0.5 text-[13px]">{children}</code>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="link link-primary">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
