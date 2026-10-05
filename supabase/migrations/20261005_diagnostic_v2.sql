-- ============================================================
-- TARGETED DIAGNOSTIC v2 — Check ALL schemas for tables
-- ============================================================

-- Check tables in public schema
SELECT 'TABLES_public' as section, table_name as name
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check tables in auth schema
SELECT 'TABLES_auth' as section, table_name as name
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY table_name;

-- Check enums in public
SELECT 'ENUMS' as section, typname as name
FROM pg_type t 
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype = 'e'
ORDER BY typname;

-- Check extensions
SELECT 'EXTENSIONS' as section, extname as name
FROM pg_extension
ORDER BY extname;

-- Check if atendimentos exists in any schema
SELECT 'ATENDIMENTOS_SEARCH' as section, 
  n.nspname as schema_name, c.relname as table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'atendimentos'
ORDER BY n.nspname;

-- List ALL schemas
SELECT 'SCHEMAS' as section, nspname as name
FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema'
ORDER BY nspname;
