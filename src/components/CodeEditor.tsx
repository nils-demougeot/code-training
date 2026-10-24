import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { EditorState, Prec, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, type DecorationSet } from '@codemirror/view'
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { useEffect, useMemo, useRef } from 'react'
import { useSettings } from '@/lib/settings'

const setErrorLine = StateEffect.define<number | null>()

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (e.value == null || e.value < 1 || e.value > tr.state.doc.lines) return Decoration.none
        const line = tr.state.doc.line(e.value)
        return Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(line.from)])
      }
    }
    // Typing clears the marker: the reported line is likely stale.
    return tr.docChanged ? Decoration.none : deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

export interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onRun?: () => void
  onSubmit?: () => void
  /** F2: open the documentation on the word under the cursor. */
  onDoc?: (query: string) => void
  errorLine?: number | null
  language?: 'python' | 'sql'
  autocomplete?: boolean
  minHeight?: string
  height?: string
  autoFocus?: boolean
  placeholder?: string
  lineNumbers?: boolean
  fontSize?: number
}

export function CodeEditor({
  value,
  onChange,
  onRun,
  onSubmit,
  onDoc,
  errorLine,
  language = 'python',
  autocomplete = true,
  minHeight,
  height = '100%',
  autoFocus,
  placeholder,
  lineNumbers = true,
  fontSize,
}: CodeEditorProps) {
  const ref = useRef<ReactCodeMirrorRef>(null)
  const settingsFont = useSettings((s) => s.editorFontSize)
  const handlers = useRef({ onRun, onSubmit, onDoc })
  handlers.current = { onRun, onSubmit, onDoc }

  const extensions = useMemo<Extension[]>(
    () => [
      language === 'sql' ? sql() : python(),
      indentUnit.of('    '),
      EditorState.tabSize.of(4),
      errorLineField,
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              handlers.current.onRun?.()
              return !!handlers.current.onRun
            },
          },
          {
            // Ctrl/Cmd+S runs the code (and keeps the browser's "save page" dialog away).
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              handlers.current.onRun?.()
              return true
            },
          },
          {
            key: 'F2',
            run: (view) => {
              if (!handlers.current.onDoc) return false
              const { head } = view.state.selection.main
              const word = view.state.wordAt(head)
              handlers.current.onDoc(word ? view.state.sliceDoc(word.from, word.to) : '')
              return true
            },
          },
          {
            key: 'Mod-Shift-Enter',
            run: () => {
              handlers.current.onSubmit?.()
              return !!handlers.current.onSubmit
            },
          },
        ]),
      ),
      keymap.of([indentWithTab]),
      EditorView.theme({
        '&': { fontSize: `${fontSize ?? settingsFont}px` },
        '.cm-content': { padding: '12px 0' },
      }),
    ],
    [language, fontSize, settingsFont],
  )

  useEffect(() => {
    const view = ref.current?.view
    if (view) view.dispatch({ effects: setErrorLine.of(errorLine ?? null) })
  }, [errorLine])

  return (
    <CodeMirror
      ref={ref}
      value={value}
      onChange={onChange}
      theme={tokyoNight}
      extensions={extensions}
      height={height}
      minHeight={minHeight}
      autoFocus={autoFocus}
      placeholder={placeholder}
      basicSetup={{
        lineNumbers,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: lineNumbers,
        autocompletion: autocomplete,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
        tabSize: 4,
      }}
      className="h-full"
    />
  )
}
