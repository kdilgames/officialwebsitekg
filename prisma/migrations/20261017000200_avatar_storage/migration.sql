-- KDILGAMES Marketplace — public avatar storage
--
-- Adds a third bucket for user avatars and store logos. Both are small, public
-- images, so they share one bucket; ownership is decided per object. The first
-- path segment is either the uploader's own `User.id` (personal avatar) or a
-- `SellerProfile.id` that belongs to them (store logo).
--
-- Also grants owners SELECT on the already-public `product-images` bucket. The
-- bucket serves objects through the public URL route, but the upload flow reads
-- the object back with `list()` to verify the real size, and `list()` is subject
-- to RLS. Without the policy that verification fails and uploads cannot be
-- finalised.
--
-- Every statement is guarded, so this migration is a no-op on a plain
-- PostgreSQL server (for example local CI).

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage.buckets not found - skipping avatar bucket setup';
    RETURN;
  END IF;

  -- ---- bucket ------------------------------------------------------------
  INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('avatars', 'avatars', true, 2097152)
  ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit;

  -- ---- ownership helpers -------------------------------------------------
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.kdil_is_avatar_owner(object_name text)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $body$
      SELECT EXISTS (
        SELECT 1
          FROM public."User" u
         WHERE u."authUserId" = auth.uid()
           AND u."id"::text = split_part(object_name, '/', 1)
      ) OR EXISTS (
        SELECT 1
          FROM public."SellerProfile" s
          JOIN public."User" su ON su."id" = s."userId"
         WHERE su."authUserId" = auth.uid()
           AND s."id"::text = split_part(object_name, '/', 1)
      );
    $body$;
  $fn$;

  REVOKE ALL ON FUNCTION public.kdil_is_avatar_owner(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.kdil_is_avatar_owner(text) TO authenticated;

  -- ---- avatars policies --------------------------------------------------
  DROP POLICY IF EXISTS kdil_avatars_insert ON storage.objects;
  CREATE POLICY kdil_avatars_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND public.kdil_is_avatar_owner(name));

  DROP POLICY IF EXISTS kdil_avatars_update ON storage.objects;
  CREATE POLICY kdil_avatars_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND public.kdil_is_avatar_owner(name))
    WITH CHECK (bucket_id = 'avatars' AND public.kdil_is_avatar_owner(name));

  DROP POLICY IF EXISTS kdil_avatars_delete ON storage.objects;
  CREATE POLICY kdil_avatars_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND public.kdil_is_avatar_owner(name));

  DROP POLICY IF EXISTS kdil_avatars_select ON storage.objects;
  CREATE POLICY kdil_avatars_select ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'avatars' AND public.kdil_is_avatar_owner(name));

  -- ---- product-images: let the owner verify an upload ---------------------
  DROP POLICY IF EXISTS kdil_product_images_select ON storage.objects;
  CREATE POLICY kdil_product_images_select ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'product-images' AND public.kdil_is_storage_owner(name));
END $$;
