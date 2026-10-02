-- ============================================================
-- DEDUPLICATE instituicoes TABLE (PostgreSQL-compatible)
-- Keeps the FIRST occurrence (lowest id) for each nome.
-- Migrates FK references before deleting duplicates.
-- Run in: Supabase SQL Editor
-- ============================================================

-- Step 1: Check current state
SELECT 'Before' as step, COUNT(*) as total FROM instituicoes;

-- Step 2: Migrate profiles.instituicao_id — point duplicates to the kept (min) id
UPDATE profiles p
SET instituicao_id = sub.keep_id
FROM (
  SELECT nome, MIN(id) as keep_id 
  FROM instituicoes 
  GROUP BY nome 
  HAVING COUNT(*) > 1
) sub
WHERE p.instituicao_id IN (
  SELECT i2.id FROM instituicoes i2 WHERE i2.nome = sub.nome
)
AND p.instituicao_id != sub.keep_id;

-- Step 3: Same for agendamentos if column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'instituicao_id') THEN
    UPDATE agendamentos a
    SET instituicao_id = sub.keep_id
    FROM (
      SELECT nome, MIN(id) as keep_id 
      FROM instituicoes 
      GROUP BY nome 
      HAVING COUNT(*) > 1
    ) sub
    WHERE a.instituicao_id IN (
      SELECT i2.id FROM instituicoes i2 WHERE i2.nome = sub.nome
    )
    AND a.instituicao_id != sub.keep_id;
  END IF;
END $$;

-- Step 4: Delete duplicate rows (keep only the lowest id per nome)
DELETE FROM instituicoes
WHERE id NOT IN (
  SELECT MIN(id) FROM instituicoes GROUP BY nome
);

-- Step 5: Verify result
SELECT 'After' as step, COUNT(*) as total FROM instituicoes;
SELECT 'Remaining dupes (should be 0):' as step, nome, COUNT(*) as cnt 
  FROM instituicoes GROUP BY nome HAVING COUNT(*) > 1;

-- Step 6: Add UNIQUE index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS instituicoes_nome_unique 
  ON instituicoes (nome);
