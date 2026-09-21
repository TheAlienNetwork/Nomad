import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { MemoirLeaf } from '@/components/memoir-page';
import { INK_COLORS, PRINT_PAGE_FONTS } from '@/src/journal';
import type { InkColor, JournalStyle, PageFont, PageSketch } from '@/src/store';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function leafHtml(
  leaf: MemoirLeaf,
  sketches: PageSketch[],
  journalStyle: JournalStyle,
  timeline: string[],
): string {
  const color = INK_COLORS[leaf.inkColor ?? 'walnut'];
  const family = PRINT_PAGE_FONTS[leaf.fontFamily ?? 'serif'];
  const marks = sketches
    .map(
      (sketch) =>
        `<img src="${sketch.uri}" style="position:absolute;left:${sketch.x}%;top:${sketch.y}%;width:${sketch.width}%;height:${sketch.height}%;object-fit:contain;background:transparent;z-index:0;" />`,
    )
    .join('');
  const facts =
    journalStyle === 'field' && timeline.length > 0
      ? `<h2>Hunt timeline</h2>${timeline.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}`
      : '';
  if (leaf.kind === 'title') {
    const coverWidth = leaf.coverWidth ?? 80;
    const cover = leaf.coverUri
      ? `<img src="${leaf.coverUri}" style="display:block;width:${coverWidth}%;max-height:140mm;object-fit:${leaf.coverSketch ? 'contain' : 'cover'};margin:0 auto 24px;border:${leaf.coverSketch ? 'none' : '1px solid rgba(90,51,32,0.45)'};background:transparent;" />`
      : '';
    const byline = leaf.author?.trim() ? `<p class="by">by ${escapeHtml(leaf.author.trim())}</p>` : '';
    const place = leaf.notes.trim() ? `<p class="place">${escapeHtml(leaf.notes.trim())}</p>` : '';
    return `<section class="page cover" style="color:${color};font-family:${family};">
  ${cover}
  <h1>${escapeHtml(leaf.title || 'Untitled')}</h1>
  ${byline}
  ${place}
</section>`;
  }
  return `<section class="page" style="color:${color};font-family:${family};position:relative;">
  ${marks}
  <div style="position:relative;z-index:1;">
  <p class="meta">${escapeHtml(new Date(leaf.dateIso).toLocaleDateString())}</p>
  <h1>${escapeHtml(leaf.title || 'Untitled')}</h1>
  <div class="notes">${escapeHtml(leaf.notes)}</div>
  ${facts}
  </div>
</section>`;
}

export function memoirBookHtml(
  leaves: MemoirLeaf[],
  sketchesByPage: Record<string, PageSketch[]>,
  journalStyle: JournalStyle,
  timelines: Record<string, string[]>,
): string {
  const pages = leaves
    .map((leaf) => leafHtml(leaf, sketchesByPage[leaf.id] ?? [], journalStyle, timelines[leaf.id] ?? []))
    .join('');
  const title = leaves.find((leaf) => leaf.kind === 'title')?.title || 'Field memoir';
  return `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 16mm; }
  body { background: #f3e4c4; margin: 0; }
  .page { min-height: 240mm; padding: 24px 28px 24px 48px; page-break-after: always; }
  .cover { text-align: center; padding-top: 32px; }
  h1 { font-size: 26px; margin: 0 0 8px; }
  .cover h1 { font-size: 32px; margin: 8px 0 12px; }
  .by { font-style: italic; font-size: 16px; margin: 0 0 8px; }
  .place { font-style: italic; font-size: 15px; margin: 0; }
  h2 { font-size: 16px; margin: 20px 0 8px; }
  .meta { font-style: italic; margin-bottom: 8px; }
  .notes { white-space: pre-wrap; font-size: 16px; line-height: 1.7; }
</style></head><body>${pages}</body></html>`;
}

export function memoirPrintHtml(
  leaf: MemoirLeaf,
  sketches: PageSketch[],
  ink: InkColor,
  font: PageFont,
  journalStyle: JournalStyle,
  timeline: string[],
): string {
  return memoirBookHtml(
    [{ ...leaf, inkColor: leaf.inkColor ?? ink, fontFamily: leaf.fontFamily ?? font }],
    { [leaf.id]: sketches },
    journalStyle,
    { [leaf.id]: timeline },
  );
}

async function printHtml(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') {
      throw new Error('Print is unavailable.');
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      throw new Error('Print is unavailable in this browser.');
    }
    doc.open();
    doc.write(html);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
    return;
  }
  const file = await Print.printToFileAsync({ html });
  if (!file.uri) throw new Error('Print is unavailable on this device.');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    return;
  }
  await Print.printAsync({ html });
}

export async function printMemoirPage(
  leaf: MemoirLeaf,
  sketches: PageSketch[],
  ink: InkColor,
  font: PageFont,
  journalStyle: JournalStyle,
  timeline: string[],
): Promise<void> {
  await printHtml(memoirPrintHtml(leaf, sketches, ink, font, journalStyle, timeline));
}

export async function printMemoirBook(
  leaves: MemoirLeaf[],
  sketchesByPage: Record<string, PageSketch[]>,
  journalStyle: JournalStyle,
  timelines: Record<string, string[]>,
): Promise<void> {
  if (leaves.length === 0) throw new Error('Nothing to print yet.');
  await printHtml(memoirBookHtml(leaves, sketchesByPage, journalStyle, timelines));
}
