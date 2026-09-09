'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { forwardRef, useImperativeHandle, useEffect, useState, useRef } from 'react'

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

// Curated palette with Starpie aesthetic
const PRESET_COLORS = [
  { label: 'Siyah / Varsayılan', value: '#1f2937' },
  { label: 'Starpie Pembe', value: '#db2777' },
  { label: 'Canlı Fuşya', value: '#ec4899' },
  { label: 'Koyu Gül', value: '#9d174d' },
  { label: 'Pastel Pembe', value: '#f472b6' },
  { label: 'Lavanta Mor', value: '#8b5cf6' },
  { label: 'İndigo', value: '#6366f1' },
  { label: 'Mavi', value: '#2563eb' },
  { label: 'Zümrüt Yeşil', value: '#059669' },
  { label: 'Sıcak Turuncu', value: '#ea580c' },
]

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
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
    const [customHex, setCustomHex] = useState('')
    const colorPickerRef = useRef<HTMLDivElement>(null)

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
        Underline,
        TextStyle,
        Color,
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

    // Close color popover on outside click
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
          setIsColorPickerOpen(false)
        }
      }

      if (isColorPickerOpen) {
        document.addEventListener('mousedown', handleClickOutside)
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isColorPickerOpen])

    if (!editor) {
      return (
        <div
          className={`rich-editor-skeleton ${compact ? 'is-compact' : ''}`}
          style={{ minHeight: minHeight ?? (compact ? '38px' : '90px') }}
        />
      )
    }

    const activeColor = editor.getAttributes('textStyle').color || ''

    const handleApplyColor = (color: string) => {
      if (!color) {
        editor.chain().focus().unsetColor().run()
      } else {
        editor.chain().focus().setColor(color).run()
      }
    }

    const handleCustomHexSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      let hex = customHex.trim()
      if (!hex) return
      if (!hex.startsWith('#')) hex = '#' + hex
      if (/^#[0-9A-Fa-f]{3,8}$/.test(hex)) {
        handleApplyColor(hex)
        setIsColorPickerOpen(false)
      }
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

          {/* Color Picker Button & Popover */}
          <div className="rich-color-picker-wrapper" ref={colorPickerRef}>
            <button
              type="button"
              className={`rich-toolbar-btn rich-toolbar-btn--color ${isColorPickerOpen || activeColor ? 'is-active-color' : ''}`}
              onClick={() => {
                setIsColorPickerOpen(prev => !prev)
                if (activeColor) setCustomHex(activeColor)
              }}
              disabled={disabled}
              title="Yazı Rengi"
              aria-label="Yazı Rengi"
              aria-expanded={isColorPickerOpen}
            >
              <span className="rich-color-icon-wrap">
                <span className="rich-color-letter">A</span>
                <span
                  className="rich-color-bar"
                  style={{ backgroundColor: activeColor || '#db2777' }}
                />
              </span>
            </button>

            {/* Color Picker Dropdown Popover */}
            {isColorPickerOpen && (
              <div className="rich-color-popover" role="dialog" aria-label="Renk Seçici">
                <div className="rich-color-popover-header">
                  <span className="rich-color-popover-title">Yazı Rengi</span>
                  {activeColor && (
                    <button
                      type="button"
                      className="rich-color-reset-btn"
                      onClick={() => {
                        handleApplyColor('')
                        setCustomHex('')
                        setIsColorPickerOpen(false)
                      }}
                      title="Rengi Sıfırla"
                    >
                      Sıfırla
                    </button>
                  )}
                </div>

                {/* Swatches Grid */}
                <div className="rich-color-swatches-grid">
                  {PRESET_COLORS.map(c => {
                    const isSelected = activeColor.toLowerCase() === c.value.toLowerCase()
                    return (
                      <button
                        key={c.value}
                        type="button"
                        className={`rich-color-swatch ${isSelected ? 'is-selected' : ''}`}
                        style={{ backgroundColor: c.value }}
                        onClick={() => {
                          handleApplyColor(c.value)
                          setCustomHex(c.value)
                          setIsColorPickerOpen(false)
                        }}
                        title={c.label}
                        aria-label={c.label}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Custom HEX / Color Picker Form */}
                <div className="rich-color-custom-row">
                  <label className="rich-color-native-label" title="Renk Paletini Aç">
                    <span
                      className="rich-color-native-preview"
                      style={{ backgroundColor: customHex || activeColor || '#db2777' }}
                    />
                    <input
                      type="color"
                      className="rich-color-native-input"
                      value={customHex.startsWith('#') && customHex.length === 7 ? customHex : (activeColor || '#db2777')}
                      onChange={e => {
                        setCustomHex(e.target.value.toUpperCase())
                        handleApplyColor(e.target.value)
                      }}
                    />
                  </label>

                  <form onSubmit={handleCustomHexSubmit} className="rich-color-hex-form">
                    <input
                      type="text"
                      className="rich-color-hex-input"
                      placeholder="#DB2777"
                      maxLength={7}
                      value={customHex}
                      onChange={e => setCustomHex(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="rich-color-hex-btn"
                      title="Uygula"
                      disabled={!customHex.trim()}
                    >
                      ✓
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
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
