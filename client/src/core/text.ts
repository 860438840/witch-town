export type Measure = (s: string) => number;

/** 按字符换行（中文没有空格分词），保留文本里原有的换行 */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (line && measure(line + ch) > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function ellipsize(text: string, maxWidth: number, measure: Measure): string {
  if (measure(text) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 0 && measure(chars.join('') + '…') > maxWidth) chars.pop();
  return chars.join('') + '…';
}
