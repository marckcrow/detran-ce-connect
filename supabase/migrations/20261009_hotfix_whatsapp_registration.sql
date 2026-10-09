-- ============================================================
-- HOTFIX: WhatsApp column + registration error fix
-- Date: 2026-10-09
-- Adds whatsapp column to profiles and access_requests
-- Run this BEFORE the main P1+P2 migration (or together)
-- ============================================================

-- 1. Add whatsapp column to profiles
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp TEXT;
  COMMENT ON COLUMN public.profiles.whatsapp IS 'Numero de WhatsApp do usuario (se diferente do telefone)';
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'profiles.whatsapp already exists';
END $$;

-- 2. Add whatsapp column to access_requests
DO $$ BEGIN
  ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS whatsapp TEXT;
  COMMENT ON COLUMN public.access_requests.whatsapp IS 'Numero de WhatsApp do solicitante';
EXCEPTION WHEN duplicate_column OR undefined_table THEN RAISE NOTICE 'access_requests.whatsapp: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN RAISE NOTICE 'Hotfix 2026-10-09: whatsapp columns added.'; END $$;
