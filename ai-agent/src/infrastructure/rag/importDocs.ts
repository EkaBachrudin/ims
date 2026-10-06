import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { ingestPool } from "../db";
import { upsertKnowledgeDoc } from "./knowledgeDocStore";

/**
 * Impor satu kali: salin dokumen `docs/knowledge/*.md|txt` ke tabel
 * `knowledge_documents` (source of truth baru). Idempoten.
 */

const KNOWLEDGE_DIR = join(__dirname, "../../../docs/knowledge");

const DOC_TYPE_BY_FILE: Record<string, string> = {
  "skema-data.md": "faq",
  "faq-operasional.md": "faq",
  "kebijakan.md": "kebijakan",
  "runbook-error.md": "runbook",
  "panduan-produk-frozen.md": "panduan-produk",
  "onboarding-peran.md": "onboarding",
};

function titleFromContent(filename: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return filename.replace(/\.(md|txt)$/i, "");
}

async function main() {
  console.log("Impor dokumen knowledge ke tabel knowledge_documents...");
  const pool = ingestPool();
  try {
    const files = (await readdir(KNOWLEDGE_DIR)).filter((f) =>
      [".md", ".txt"].includes(extname(f).toLowerCase()),
    );
    for (const file of files) {
      const content = await readFile(join(KNOWLEDGE_DIR, file), "utf8");
      const { action } = await upsertKnowledgeDoc(pool, {
        filename: file,
        title: titleFromContent(file, content),
        docType: DOC_TYPE_BY_FILE[file] ?? "sop",
        content,
      });
      console.log(`  ✓ ${file}: ${action}`);
    }
    console.log(`Selesai. ${files.length} dokumen diproses.`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Impor gagal:", err);
      process.exit(1);
    });
}
