
CREATE TABLE public.generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tema TEXT NOT NULL,
  objetivo TEXT,
  publico_alvo TEXT,
  tom TEXT,
  quantidade_slides INTEGER NOT NULL,
  informacoes_adicionais TEXT,
  titulo TEXT NOT NULL,
  legenda TEXT NOT NULL,
  hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generations TO authenticated;
GRANT ALL ON public.generations TO service_role;

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.generations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.generations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.generations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.generations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX generations_user_created_idx ON public.generations (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER generations_updated_at
BEFORE UPDATE ON public.generations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rate limit: 30 gerações por usuário nas últimas 24h
CREATE OR REPLACE FUNCTION public.can_generate(_user_id UUID, _max INTEGER DEFAULT 30)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (SELECT count(*) FROM public.generations
          WHERE user_id = _user_id
            AND created_at > now() - INTERVAL '24 hours') < _max;
$$;

GRANT EXECUTE ON FUNCTION public.can_generate(UUID, INTEGER) TO authenticated;
