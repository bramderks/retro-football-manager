ALTER TABLE public.cm0102_player_profiles
  ADD COLUMN IF NOT EXISTS source_potential_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS pa_resolution_rule TEXT;

CREATE INDEX IF NOT EXISTS idx_cm0102_profiles_name
  ON public.cm0102_player_profiles (full_name);

CREATE INDEX IF NOT EXISTS idx_cm0102_profiles_ca_pa
  ON public.cm0102_player_profiles (current_ability, potential_ability);
