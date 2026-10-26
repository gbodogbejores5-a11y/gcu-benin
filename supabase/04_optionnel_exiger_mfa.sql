-- ============================================================================
-- GCU-BÉNIN — OPTIONNEL : exiger l'authentification à deux facteurs (MFA / TOTP)
-- pour TOUT le personnel (accès administration)
-- ============================================================================
-- ⚠ À exécuter SEULEMENT quand chaque administrateur a activé la double
--   authentification : Administration → « Sécurité du compte » → scanner le QR
--   code avec Google Authenticator / Microsoft Authenticator / Authy.
--   Sinon un compte sans MFA perdrait l'accès à l'administration.
--
-- Une fois exécuté, les droits du personnel ne sont accordés par la base de données
-- que si la session est au niveau « aal2 » (mot de passe + code à 6 chiffres).
-- Pour annuler : relancer la section « Fonctions d'autorisation » de 01_schema.sql.
-- ============================================================================

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt()->>'aal','') = 'aal2'
     and exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt()->>'aal','') = 'aal2' and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and (ur.role_key = 'admin_principal'
           or exists (select 1 from public.role_permissions rp
                      where rp.role_key = ur.role_key and rp.permission = p))
  );
$$;

create or replace function public.my_permissions() returns text[]
language sql stable security definer set search_path = public as $$
  select case when coalesce(auth.jwt()->>'aal','') = 'aal2' then (
    select coalesce(array_agg(distinct perm), '{}') from (
      select rp.permission as perm
        from public.user_roles ur join public.role_permissions rp on rp.role_key = ur.role_key
       where ur.user_id = auth.uid()
      union
      select p.key from public.permissions p
       where exists (select 1 from public.user_roles where user_id = auth.uid() and role_key = 'admin_principal')
    ) t) else '{}'::text[] end;
$$;
