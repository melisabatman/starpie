'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { forwardRef, useImperativeHandle, useEffect } from 'react'

export interface RichTextEditorRef {
  clearContent: () => void
  focus: () => void
  getHtml: () => string
  getText: () => string
  isEmpty: () => boolean
}

interface RichTextEditorProps {
  placeholder?: string
  maxLength?: number
  compact?: boolean
  minHeight?: string | number
  initialContent?: string
  disabled?: boolean
  autoFocus?: boolean
  onChange?: (html: string, plainText: string) => void
  onSubmit?: () => void
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  (
    {
      placeholder = '',
      maxLength = 500,
      compact = false,
      minHeight,
      initialContent = '',
      disabled = false,
      autoFocus = false,
      onChange,
      onSubmit,
    },
    ref
  ) => {
    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          bold: {},
          italic: {},
          heading: false,
          codeBlock: false,
          blockquote: false,
          bulletList: false,
          orderedList: false,
          horizontalRule: false,
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass: 'is-editor-empty',
        }),
      ],
      content: initialContent,
      editable: !disabled,
      autofocus: autoFocus,
      onUpdate: ({ editor: ed }) => {
        const text = ed.getText().trim()
        const html = text.length === 0 ? '' : ed.getHTML()
        onChange?.(html, ed.getText())
      },
      editorProps: {
        handleKeyDown: (view, event) => {
          // If compact mode (comment form) and Enter is pressed without Shift, trigger submit
          if (compact && event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSubmit?.()
            return true
          }
          return false
        },
      },
    })

    // Expose methods to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        clearContent: () => {
          editor?.commands.clearContent()
        },
        focus: () => {
          editor?.commands.focus()
        },
        getHtml: () => {
          if (!editor || editor.getText().trim().length === 0) return ''
          return editor.getHTML()
        },
        getText: () => {
          return editor ? editor.getText() : ''
        },
        isEmpty: () => {
          return !editor || editor.getText().trim().length === 0
        },
      }),
      [editor]
    )

    // Update editable state if disabled changes
    useEffect(() => {
      if (editor && editor.isEditable === disabled) {
        editor.setEditable(!disabled)
      }
    }, [editor, disabled])

    if (!editor) {
      return (
        <div
          className={`rich-editor-skeleton ${compact ? 'is-compact' : ''}`}
          style={{ minHeight: minHeight ?? (compact ? '38px' : '90px') }}
        />
      )
    }

    return (
      <div className={`rich-editor-wrapper ${compact ? 'rich-editor--compact' : ''}`}>
        {/* ─── Compact/Standard Toolbar ─── */}
        <div className="rich-editor-toolbar" role="toolbar" aria-label="Metin biçimlendirme">
          {/* Bold Button */}
          <button
            type="button"
            className={`rich-toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
            title="Kalın (Ctrl+B)"
            aria-label="Kalın"
          >
            <strong>B</strong>
          </button>

          {/* Italic Button */}
          <button
            type="button"
            className={`rich-toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
            title="İtalik (Ctrl+I)"
            aria-label="İtalik"
          >
            <em>I</em>
          </button>

          {/* Underline Button */}
          <button
            type="button"
            className={`rich-toolbar-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={disabled}
            title="Altı Çizili (Ctrl+U)"
            aria-label="Altı Çizili"
          >
            <u>U</u>
          </button>
        </div>

        {/* ─── Editor Content Box ─── */}
        <div
          className="rich-editor-content-box"
          style={{ minHeight: minHeight ?? (compact ? '38px' : '90px') }}
          onClick={() => editor.commands.focus()}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }
)

RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor
