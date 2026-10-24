export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string }

/** Comparison key of a line: trailing comments and spacing differences don't count. */
const keyOf = (line: string) => {
  const indent = line.match(/^\s*/)![0]
  return indent + line.slice(indent.length).replace(/\s+#[^'"]*$/, '').replace(/\s+/g, ' ').trimEnd()
}

/** Line diff (LCS) between two code snippets, ignoring blank lines, comment-only lines,
 * trailing comments and whitespace differences. */
export function diffLines(before: string, after: string): DiffLine[] {
  const clean = (s: string) => s.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== '' && !l.trim().startsWith('#'))
  const a = clean(before)
  const b = clean(after)
  const ka = a.map(keyOf)
  const kb = b.map(keyOf)
  const n = a.length
  const m = b.length
  // lcs[i][j] = length of the LCS of a[i:] and b[j:]
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = ka[i] === kb[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (ka[i] === kb[j]) {
      out.push({ kind: 'same', text: b[j] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: 'del', text: a[i++] })
    } else {
      out.push({ kind: 'add', text: b[j++] })
    }
  }
  while (i < n) out.push({ kind: 'del', text: a[i++] })
  while (j < m) out.push({ kind: 'add', text: b[j++] })
  return out
}

/** Share of the reference lines found unchanged in the attempt (0..1). */
export function similarity(diff: DiffLine[]): number {
  const same = diff.filter((d) => d.kind === 'same').length
  const reference = diff.filter((d) => d.kind !== 'add').length
  return reference ? same / reference : 1
}
