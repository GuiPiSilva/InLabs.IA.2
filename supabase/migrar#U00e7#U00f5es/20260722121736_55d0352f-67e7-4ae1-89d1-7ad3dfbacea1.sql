
-- Access keys managed by admin
CREATE TABLE public.access_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text,
  active boolean NOT NULL DEFAULT true,
  uses integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.access_keys TO service_role;
ALTER TABLE public.access_keys ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (server functions) may access.

-- Make generations independent of Supabase auth users
ALTER TABLE public.generations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS access_key_id uuid REFERENCES public.access_keys(id) ON DELETE SET NULL;

-- Drop old per-user policies (auth removed for carousel flow)
DROP POLICY IF EXISTS own_delete ON public.generations;
DROP POLICY IF EXISTS own_insert ON public.generations;
DROP POLICY IF EXISTS own_select ON public.generations;
DROP POLICY IF EXISTS own_update ON public.generations;
REVOKE ALL ON public.generations FROM authenticated;
GRANT ALL ON public.generations TO service_role;
