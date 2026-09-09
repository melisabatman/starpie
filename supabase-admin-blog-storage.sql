-- ============================================================
-- Starpie — Admin Köşe Yazıları (admin-posts) Storage RLS Politikaları
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================

-- 1. "admin-posts" bucket'ının var ve public olduğundan emin ol
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-posts', 'admin-posts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. SELECT: Herkes admin köşe yazısı kapak fotoğraflarını görüntüleyebilir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin blog images are publicly accessible'
  ) THEN
    CREATE POLICY "Admin blog images are publicly accessible"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'admin-posts');
  END IF;
END $$;

-- 3. INSERT: Yalnızca role = 'admin' olan kullanıcılar admin-posts bucket'ına fotoğraf yükleyebilir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Only admin can upload admin blog images'
  ) THEN
    CREATE POLICY "Only admin can upload admin blog images"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'admin-posts'
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- 4. UPDATE: Yalnızca role = 'admin' olan kullanıcılar görsel güncelleyebilir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Only admin can update admin blog images'
  ) THEN
    CREATE POLICY "Only admin can update admin blog images"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'admin-posts'
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- 5. DELETE: Yalnızca role = 'admin' olan kullanıcılar silebilir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Only admin can delete admin blog images'
  ) THEN
    CREATE POLICY "Only admin can delete admin blog images"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'admin-posts'
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;
