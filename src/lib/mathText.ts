/** A line made only of `$$…$$` is display math: give it its own block (keeping its indentation,
 * e.g. inside a list item), otherwise remark-math renders it inline, squeezed into the paragraph. */
export function displayMath(text: string): string {
  return text.replace(/^([ \t]*)\$\$([^\n]+?)\$\$[ \t]*$/gm, (_, ind: string, tex: string) => `\n${ind}$$\n${ind}${tex.trim()}\n${ind}$$\n`)
}
