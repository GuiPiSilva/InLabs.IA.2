
REVOKE ALL ON FUNCTION public.can_generate(UUID, INTEGER) FROM PUBLIC, authenticated, anon;
DROP FUNCTION IF EXISTS public.can_generate(UUID, INTEGER);
