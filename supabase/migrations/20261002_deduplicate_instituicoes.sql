-- ============================================================
-- DEDUPLICATE instituicoes TABLE (UUID-safe, PostgreSQL)
-- Keeps the FIRST occurrence (lowest id) for each nome.
-- Migrates FK references before deleting duplicates.
-- Run in: Supabase SQL Editor
-- ============================================================

-- Step 1: Check current state
SELECT 'Before' as step, COUNT(*) as total FROM instituicoes;

-- Step 2: Create temp table with the ID to keep per duplicate group
DROP TABLE IF EXISTS _dedup_keep;
CREATE TEMP TABLE _dedup_keep AS
SELECT DISTINCT ON (nome) id as keep_id, nome
FROM instituicoes
ORDER BY nome, id;

-- Show what we found
SELECT * FROM _dedup_keep ORDER BY nome;

-- Step 3: Migrate profiles.instituicao_id — point duplicates to the kept id
UPDATE profiles p
SET instituicao_id = k.keep_id
FROM _dedup_keep k
WHERE p.instituicao_id != k.keep_id
AND p.instituicao_id IN (SELECT i.id FROM instituicoes i WHERE i.nome = k.nome);

-- Step 4: Same for agendamentos if column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'instituicao_id') THEN
    UPDATE agendamentos a
    SET instituicao_id = k.keep_id
    FROM _dedup_keep k
    WHERE a.instituicao_id != k.keep_id
    AND a.instituicao_id IN (SELECT i.id FROM instituicoes i WHERE i.nome = k.nome);
  END IF;
END $$;

-- Step 5: Delete all rows EXCEPT the ones we want to keep
DELETE FROM instituicoes
WHERE id NOT IN (SELECT keep_id FROM _dedup_keep);

-- Step 6: Verify
SELECT 'After' as step, COUNT(*) as total FROM instituicoes;

-- Check for any remaining duplicates (should return 0 rows)
SELECT nome, COUNT(*) as cnt 
FROM instituicoes 
GROUP BY nome 
HAVING COUNT(*) > 1;

-- Step 7: Add UNIQUE constraint on nome to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS instituicoes_nome_unique 
ON instituicoes (nome);

-- Cleanup
DROP TABLE IF EXISTS _dedup_keep;
