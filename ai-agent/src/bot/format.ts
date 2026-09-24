import type { Context } from "telegraf";

const CODE_BLOCK_TOKEN = "\u0000CODE";
const INLINE_CODE_TOKEN = "\u0000INLINE";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeHtml(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function stripHtml(html: string): string {
  return unescapeHtml(html.replace(/<\/?(?:b|i|u|s|code|pre|blockquote)>/g, ""));
}

function formatTableLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      if (!line.includes("|")) return true;
      const isSeparator = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line);
      return !isSeparator;
    })
    .map((line) => {
      if (!line.includes("|")) return line;
      return line
        .replace(/\s*\|\s*/g, " • ")
        .replace(/^\s*•\s*/, "")
        .replace(/\s*•\s*$/, "")
        .trim();
    })
    .join("\n");
}

/**
 * Konversi subset Markdown yang umum dihasilkan LLM menjadi HTML yang
 * didukung Telegram (parse_mode: "HTML").
 *
 * Seluruh teks di-escape lebih dulu, lalu tag yang aman ditambahkan, sehingga
 * karakter `<`, `>`, `&` dari data tidak merusak parsing Telegram.
 */
export function markdownToTelegramHtml(markdown: string): string {
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  let text = markdown.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_match, code: string) => {
    codeBlocks.push(`<pre>${escapeHtml(code.replace(/\n$/, ""))}</pre>`);
    return `${CODE_BLOCK_TOKEN}${codeBlocks.length - 1}\u0000`;
  });

  text = text.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `${INLINE_CODE_TOKEN}${inlineCodes.length - 1}\u0000`;
  });

  text = escapeHtml(text);
  text = formatTableLines(text);

  text = text.replace(/^#{1,6}\s*/gm, "");
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  text = text.replace(/__([^_\n]+)__/g, "<b>$1</b>");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
  text = text.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, "$1<i>$2</i>");
  text = text.replace(/^(\s*)[-*+]\s+/gm, "$1• ");
  text = text.replace(/\n{3,}/g, "\n\n");

  text = text.replace(
    new RegExp(`${INLINE_CODE_TOKEN}(\\d+)\\u0000`, "g"),
    (_m, i: string) => inlineCodes[Number(i)],
  );
  text = text.replace(
    new RegExp(`${CODE_BLOCK_TOKEN}(\\d+)\\u0000`, "g"),
    (_m, i: string) => codeBlocks[Number(i)],
  );

  return text.trim();
}

/**
 * Kirim balasan dengan format Telegram HTML. Bila Telegram menolak parse
 * (mis. entitas tidak valid), pesan dikirim ulang sebagai teks polos agar
 * balasan tidak pernah hilang.
 */
export async function sendFormatted(ctx: Context, markdown: string): Promise<void> {
  if (!markdown.trim()) return;

  const html = markdownToTelegramHtml(markdown);
  try {
    await ctx.reply(html, { parse_mode: "HTML" });
  } catch {
    await ctx.reply(stripHtml(html));
  }
}
