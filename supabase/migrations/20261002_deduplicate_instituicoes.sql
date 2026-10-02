-- ============================================================
-- DEDUPLICATE instituicoes TABLE
-- Safe cleanup: keeps the FIRST occurrence (lowest id),
-- migrates foreign key references from duplicates to the kept row,
-- then removes duplicates.
-- Run in: Supabase SQL Editor
-- ============================================================

-- Step 1: Check current state
SELECT 'Before' as step, COUNT(*) as total FROM instituicoes;
SELECT 'Duplicates' as step, nome, COUNT(*) as cnt 
  FROM instituicoes 
  GROUP BY nome HAVING COUNT(*) > 1 
  ORDER BY cnt DESC;

-- Step 2: Create a temporary mapping table to track which IDs to keep vs remove
DROP TABLE IF EXISTS _dedup_map;
CREATE TEMP TABLE _dedup AS
  SELECT nome, 
         MIN(id) as keep_id,
         array_agg(id ORDER BY id) as all_ids,
         array_agg(id ORDER BY id)[2:] as remove_ids
  FROM instituicoes
  GROUP BY nome
  HAVING COUNT(*) > 1;

-- Show what will be migrated
SELECT 'Migrating FK refs from duplicates:' as info, * FROM _dedup_map;

-- Step 3: Migrate profiles.instituicao_id from duplicate IDs to the kept ID
UPDATE profiles p
SET instituicao_id = d.keep_id
FROM _dedup_map d
WHERE p.instituicao_id = ANY(d.remove_ids);

-- Step 4: Also migrate agendamentos if they reference instituicoes directly
-- (check if column exists first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'instituicao_id') THEN
    UPDATE agendamentos a
    SET instituicao_id = d.keep_id
    FROM _dedup_map d
    WHERE a.instituicao_id = ANY(d.remove_ids);
  END IF;
END $$;

-- Step 5: Delete duplicate rows (keep the one with lowest id)
DELETE FROM instituicoes
WHERE id IN (SELECT unnest(remove_ids) FROM _dedup_map);

-- Step 6: Verify result
SELECT 'After' as step, COUNT(*) as total FROM instituicoes;

-- Step 7: Add UNIQUE constraint on nome to prevent future duplicates
-- (Use partial index since we may have soft-deleted/inactive rows)
CREATE UNIQUE INDEX IF NOT EXISTS instituicoes_nome_unique 
  ON instituicoes (nome) 
  WHERE ativa IS DISTINCT FROM false;

-- Cleanup
DROP TABLE IF EXISTS _dedup_map;
