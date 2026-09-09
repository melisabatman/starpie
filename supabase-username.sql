-- ============================================================
-- STARPIE: USERNAME FIELD & UNIQUE CONSTRAINT MIGRATION
-- ============================================================
-- 1. Add username column to public.profiles table if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username text;

-- 2. Case-insensitive Unique Index to prevent duplicate usernames
-- (e.g., 'Melisa' and 'melisa' cannot both exist)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx 
ON public.profiles (lower(username));

-- 3. Unique Constraint on the username column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;

-- 4. Check constraint to enforce valid format:
-- 3 to 30 characters, letters, numbers and underscores only
DO $$ 
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS username_format_check;
  ALTER TABLE public.profiles ADD CONSTRAINT username_format_check 
    CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_]{3,30}$');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 5. Optional comment
COMMENT ON COLUMN public.profiles.username IS 'Unique @username handle for Starpie user profiles (3-30 characters, alphanumeric + underscore).';
