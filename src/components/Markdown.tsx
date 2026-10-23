import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import clsx from 'clsx'
import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

hljs.registerLanguage('python', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('bash', bash)

export function highlight(code: string, language = 'python'): string {
  try {
    return hljs.highlight(code, { language: hljs.getLanguage(language) ? language : 'python' }).value
  } catch {
    return code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
  }
}

export function CodeBlock({ code, language = 'python', className }: { code: string; language?: string; className?: string }) {
  return (
    <pre
      className={clsx(
        'overflow-x-auto rounded-xl border border-line bg-black/40 px-4 py-3 font-mono text-[0.82rem] leading-relaxed text-[#c0caf5]',
        className,
      )}
    >
      <code dangerouslySetInnerHTML={{ __html: highlight(code.replace(/\n$/, ''), language) }} />
    </pre>
  )
}

export const Markdown = memo(function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={clsx('md prose prose-invert prose-sm max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className: cls, children: content }) => {
            const match = /language-(\w+)/.exec(cls ?? '')
            const text = String(content)
            if (!match && !text.includes('\n')) return <code>{content}</code>
            return <CodeBlock code={text} language={match?.[1] ?? 'python'} className="not-prose my-4" />
          },
          a: ({ href, children: c }) => (
            <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
