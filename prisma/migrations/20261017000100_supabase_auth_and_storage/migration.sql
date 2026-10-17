-- KDILGAMES Marketplace — Supabase integration
--
-- 1. Creates a marketplace profile row whenever a Supabase Auth user signs up.
-- 2. Creates the private `product-files` and public `product-images` buckets.
-- 3. Locks the `public` schema down so the anon/publishable key cannot read
--    marketplace data through PostgREST. The application talks to Postgres with
--    the project owner role via Prisma, which is unaffected by these grants.
-- 4. Authorises storage objects with Postgres RLS policies that call
--    SECURITY DEFINER helpers, so entitlement rules live in one place.
--
-- Every statement that needs Supabase-specific objects is guarded, so this
-- migration is a no-op on a plain PostgreSQL server (for example local CI).

-- ---------------------------------------------------------------------------
-- 1. Auth users -> marketplace profile
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'auth.users not found - skipping Supabase auth triggers';
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.kdil_handle_new_auth_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      base_username text;
      final_username text;
      attempt integer := 0;
      meta jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
    BEGIN
      base_username := COALESCE(meta ->> 'username', split_part(COALESCE(new.email, 'user'), '@', 1));
      base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
      IF length(base_username) < 3 THEN
        base_username := 'user';
      END IF;
      base_username := left(base_username, 24);

      final_username := base_username;
      WHILE EXISTS (SELECT 1 FROM public."User" WHERE "username" = final_username) LOOP
        attempt := attempt + 1;
        final_username := left(base_username, 24) || attempt::text;
      END LOOP;

      INSERT INTO public."User" (
        "id", "authUserId", "username", "displayName", "email", "emailVerified",
        "role", "status", "termsAcceptedAt", "termsVersion", "country", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        new.id,
        final_username,
        COALESCE(NULLIF(meta ->> 'display_name', ''), final_username),
        COALESCE(new.email, ''),
        new.email_confirmed_at IS NOT NULL,
        'USER',
        'ACTIVE',
        CASE WHEN meta ? 'terms_version' THEN now() ELSE NULL END,
        NULLIF(meta ->> 'terms_version', ''),
        NULLIF(meta ->> 'country', ''),
        now(),
        now()
      )
      ON CONFLICT ("authUserId") DO NOTHING;

      RETURN new;
    END;
    $body$;
  $fn$;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.kdil_sync_auth_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    BEGIN
      UPDATE public."User"
         SET "email" = COALESCE(new.email, "email"),
             "emailVerified" = (new.email_confirmed_at IS NOT NULL),
             "updatedAt" = now()
       WHERE "authUserId" = new.id;
      RETURN new;
    END;
    $body$;
  $fn$;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'kdil_on_auth_user_created'
  ) THEN
    EXECUTE 'CREATE TRIGGER kdil_on_auth_user_created
             AFTER INSERT ON auth.users
             FOR EACH ROW EXECUTE FUNCTION public.kdil_handle_new_auth_user()';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'kdil_on_auth_user_updated'
  ) THEN
    EXECUTE 'CREATE TRIGGER kdil_on_auth_user_updated
             AFTER UPDATE OF email, email_confirmed_at ON auth.users
             FOR EACH ROW EXECUTE FUNCTION public.kdil_sync_auth_user()';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Storage buckets
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage schema not found - skipping bucket creation';
    RETURN;
  END IF;

  -- Paid product archives. Never publicly readable; access is via short-lived
  -- signed URLs issued only after a server-side entitlement check.
  INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('product-files', 'product-files', false, 536870912)
  ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 536870912;

  -- Public product imagery and store branding.
  INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('product-images', 'product-images', true, 8388608)
  ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 8388608;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Storage authorisation helpers (single source of truth for entitlement)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL OR to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'Supabase storage/auth not found - skipping storage policies';
    RETURN;
  END IF;

  -- True when the signed-in user owns the seller profile named by the first
  -- path segment: {sellerId}/{productId}/{fileId}/{fileName}
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.kdil_is_storage_owner(object_name text)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $body$
      SELECT EXISTS (
        SELECT 1
          FROM public."SellerProfile" s
          JOIN public."User" u ON u."id" = s."userId"
         WHERE u."authUserId" = auth.uid()
           AND s."id"::text = split_part(object_name, '/', 1)
      );
    $body$;
  $fn$;

  -- True when the signed-in user bought the product and the order is still in
  -- good standing (paid, or partially refunded on another line item).
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.kdil_has_purchased_product_file(object_name text)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $body$
      SELECT EXISTS (
        SELECT 1
          FROM public."OrderItem" oi
          JOIN public."Order" o ON o."id" = oi."orderId"
          JOIN public."User" u ON u."id" = o."buyerId"
         WHERE u."authUserId" = auth.uid()
           AND oi."sellerId"::text = split_part(object_name, '/', 1)
           AND oi."productId"::text = split_part(object_name, '/', 2)
           AND o."status" IN ('PAID', 'PARTIALLY_REFUNDED')
      );
    $body$;
  $fn$;

  REVOKE ALL ON FUNCTION public.kdil_is_storage_owner(text) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.kdil_has_purchased_product_file(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.kdil_is_storage_owner(text) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.kdil_has_purchased_product_file(text) TO authenticated;

  -- ---- product-files -----------------------------------------------------
  DROP POLICY IF EXISTS kdil_product_files_insert ON storage.objects;
  CREATE POLICY kdil_product_files_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'product-files' AND public.kdil_is_storage_owner(name));

  DROP POLICY IF EXISTS kdil_product_files_update ON storage.objects;
  CREATE POLICY kdil_product_files_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'product-files' AND public.kdil_is_storage_owner(name))
    WITH CHECK (bucket_id = 'product-files' AND public.kdil_is_storage_owner(name));

  DROP POLICY IF EXISTS kdil_product_files_delete ON storage.objects;
  CREATE POLICY kdil_product_files_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'product-files' AND public.kdil_is_storage_owner(name));

  DROP POLICY IF EXISTS kdil_product_files_select ON storage.objects;
  CREATE POLICY kdil_product_files_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'product-files'
      AND (
        public.kdil_is_storage_owner(name)
        OR public.kdil_has_purchased_product_file(name)
      )
    );

  -- ---- product-images ----------------------------------------------------
  DROP POLICY IF EXISTS kdil_product_images_insert ON storage.objects;
  CREATE POLICY kdil_product_images_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'product-images' AND public.kdil_is_storage_owner(name));

  DROP POLICY IF EXISTS kdil_product_images_update ON storage.objects;
  CREATE POLICY kdil_product_images_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'product-images' AND public.kdil_is_storage_owner(name))
    WITH CHECK (bucket_id = 'product-images' AND public.kdil_is_storage_owner(name));

  DROP POLICY IF EXISTS kdil_product_images_delete ON storage.objects;
  CREATE POLICY kdil_product_images_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'product-images' AND public.kdil_is_storage_owner(name));
END $$;

-- ---------------------------------------------------------------------------
-- 4. Keep marketplace data off PostgREST
-- ---------------------------------------------------------------------------
-- The publishable key is public. Without these statements anyone holding it
-- could query the marketplace tables directly. The application uses the project
-- owner role through Prisma, which is not affected.
DO $$
DECLARE
  target text;
BEGIN
  FOR target IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', target);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', target);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
  END IF;
END $$;
