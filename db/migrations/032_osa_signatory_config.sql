-- OSA signatory config table for editable certificate signing names

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'osa_signatory_config') THEN
    CREATE TABLE public.osa_signatory_config (
      id SERIAL PRIMARY KEY,
      signatory_name TEXT NOT NULL DEFAULT 'OSA Authorized Representative',
      signatory_title TEXT NOT NULL DEFAULT 'Office of Student Affairs',
      campus TEXT NOT NULL DEFAULT 'USTP Jasaan Campus',
      campus_director_name TEXT NOT NULL DEFAULT 'Campus Director',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    INSERT INTO public.osa_signatory_config (signatory_name, signatory_title, campus, campus_director_name)
    VALUES ('OSA Authorized Representative', 'Office of Student Affairs', 'USTP Jasaan Campus', 'Campus Director')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Add column if table already exists (migration safety)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'osa_signatory_config' AND column_name = 'campus_director_name') THEN
    ALTER TABLE public.osa_signatory_config
      ADD COLUMN campus_director_name TEXT NOT NULL DEFAULT 'Campus Director';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_osa_config ON public.osa_signatory_config (id);
