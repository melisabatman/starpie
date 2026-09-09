'use client'

import { useMemo } from 'react'
import DOMPurify from 'dompurify'

interface FormattedContentProps {
  content: string
  className?: string
}

export default function FormattedContent({
  content,
  className = '',
}: FormattedContentProps) {
  const sanitizedHtml = useMemo(() => {
    if (!content) return ''

    // Check if content contains HTML tags
    const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(content)

    if (!hasHtmlTags) {
      // Plain text: safely escape and convert newlines to <br/>
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />')
    }

    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['p', 'strong', 'b', 'em', 'i', 'u', 'br', 'span'],
        ALLOWED_ATTR: ['style'],
      })
    }

    // Safe SSR fallback: strip any tag not in whitelist
    return content.replace(/<(?!\/?(p|strong|b|em|i|u|br|span)\b)[^>]+>/gi, '')
  }, [content])

  return (
    <div
      className={`formatted-rich-text ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
