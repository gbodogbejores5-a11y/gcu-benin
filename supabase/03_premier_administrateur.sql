-- ============================================================================
-- GCU-BÉNIN — Créer le PREMIER administrateur principal
-- ============================================================================
-- Étapes :
--   1. Ouvrez le site → page « Connexion » → onglet « Créer mon compte »
--      et créez le compte de l'administrateur (e-mail réel, mot de passe fort).
--   2. Confirmez l'adresse e-mail via le message reçu.
--   3. Remplacez l'adresse ci-dessous par celle du compte, puis exécutez ce script.
--   4. Ouvrez /admin et connectez-vous.
--
-- Les autres responsables (communication, adhésions…) sont ensuite créés depuis
-- l'administration → « Rôles et accès » (ils créent d'abord leur compte sur la page Connexion).
-- ============================================================================

insert into public.user_roles (user_id, role_key)
select id, 'admin_principal'
  from auth.users
 where lower(email) = lower('VOTRE_EMAIL_ADMIN@exemple.com')
on conflict do nothing;

-- Vérification : doit afficher 1 ligne
select u.email, ur.role_key
  from public.user_roles ur join auth.users u on u.id = ur.user_id;
