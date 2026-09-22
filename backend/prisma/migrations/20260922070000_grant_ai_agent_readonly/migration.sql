-- Role read-only untuk runtime AI Agent (RAG retrieval) — least privilege.
-- Dibuat via migration agar urut setelah tabel document_chunks ada, dan
-- otomatis diterapkan oleh `prisma migrate deploy` (termasuk pada Docker Compose).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_agent') THEN
    CREATE ROLE ai_agent LOGIN PASSWORD 'ai_agent_secret';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO ai_agent;
GRANT SELECT ON TABLE document_chunks TO ai_agent;
