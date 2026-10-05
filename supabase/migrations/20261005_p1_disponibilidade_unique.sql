-- ============================================================
-- P1: DISPONIBILIDADE — unique constraint to prevent duplicates
-- Each date+turno combo should have only ONE availability entry
-- Run in: Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: Check for existing duplicate (data, turno) pairs
-- If duplicates exist, keep the most recent entry (highest created_at)
-- and delete the older ones.
-- ============================================================

-- Show duplicate pairs (for review before deletion)
-- SELECT data, turno, COUNT(*) AS cnt, MIN(created_at) AS oldest, MAX(created_at) AS newest
-- FROM public.disponibilidade
-- GROUP BY data, turno
-- HAVING COUNT(*) > 1
-- ORDER BY data DESC;

-- Delete duplicates keeping the most recently created entry
DELETE FROM public.disponibilidade a
USING public.disponibilidade b
WHERE a.data = b.data
  AND a.turno = b.turno
  AND a.id != b.id
  AND a.created_at < b.created_at;

-- Also handle same data+turno with identical created_at (rare)
DELETE FROM public.disponibilidade a
USING public.disponibilidade b
WHERE a.data = b.data
  AND a.turno = b.turno
  AND a.id < b.id  -- arbitrary but deterministic tiebreaker
  AND a.created_at = b.created_at;

-- ============================================================
-- STEP 2: Create partial unique index
-- Only one entry per (data, turno) regardless of status.
-- Each date+shift combination is unique in the calendar.
-- ============================================================
DROP INDEX IF EXISTS idx_disponibilidade_unique;
CREATE UNIQUE INDEX idx_disponibilidade_unique
  ON public.disponibilidade (data, turno);

-- ============================================================
-- STEP 3: Verify
-- ============================================================
-- SELECT 'Unique index created:' as info;
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'disponibilidade' AND indexname = 'idx_disponibilidade_unique';

-- SELECT 'Duplicate check (should return 0 rows):' as info;
-- SELECT data, turno, COUNT(*) AS cnt
-- FROM public.disponibilidade
-- GROUP BY data, turno
-- HAVING COUNT(*) > 1;

-- SELECT 'Sample disponibilidade rows:' as info;
-- SELECT id, data, turno, status, capacidade, created_at
-- FROM public.disponibilidade
-- ORDER BY data DESC, turno
-- LIMIT 10;

NOTIFY pgrst, 'reload schema';
