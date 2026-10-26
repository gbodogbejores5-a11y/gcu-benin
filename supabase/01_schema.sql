-- ============================================================================
-- GCU-BÉNIN — Schéma de base de données (PostgreSQL / Supabase)
-- À exécuter UNE FOIS dans Supabase → SQL Editor → New query → Run.
-- Principe : RLS (Row Level Security) activée partout. Les permissions sont
-- vérifiées PAR LA BASE DE DONNÉES, jamais seulement en cachant des boutons.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RÔLES ET PERMISSIONS (configurables depuis l'administration)
-- ----------------------------------------------------------------------------
create table if not exists public.permissions (
  key text primary key,
  label text not null
);

create table if not exists public.roles (
  key text primary key,
  label text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_key text not null references public.roles(key) on delete cascade on update cascade,
  permission text not null references public.permissions(key) on delete cascade on update cascade,
  primary key (role_key, permission)
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.roles(key) on delete cascade on update cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_key)
);

-- Fonctions d'autorisation (SECURITY DEFINER = lisent les tables sans être bloquées par la RLS)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and (ur.role_key = 'admin_principal'
           or exists (select 1 from public.role_permissions rp
                      where rp.role_key = ur.role_key and rp.permission = p))
  );
$$;

create or replace function public.my_permissions() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct perm), '{}') from (
    select rp.permission as perm
      from public.user_roles ur join public.role_permissions rp on rp.role_key = ur.role_key
     where ur.user_id = auth.uid()
    union
    select p.key from public.permissions p
     where exists (select 1 from public.user_roles where user_id = auth.uid() and role_key = 'admin_principal')
  ) t;
$$;

-- ----------------------------------------------------------------------------
-- 2. MEMBRES ET ADHÉSIONS
-- ----------------------------------------------------------------------------
create sequence if not exists public.member_seq start 1;

create table if not exists public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  commune text,
  level text,
  institution text,
  interest text,
  motivation text,
  consent boolean not null default false,
  status text not null default 'en_attente' check (status in ('en_attente','en_cours','accepte','refuse')),
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists membership_requests_status_idx on public.membership_requests(status, created_at desc);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  member_number text not null unique,
  verify_code text not null unique,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  commune text,
  level text,
  institution text,
  interest text,
  status text not null default 'actif' check (status in ('actif','suspendu')),
  notify_news boolean not null default true,
  notify_events boolean not null default true,
  request_id uuid references public.membership_requests(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists members_email_key on public.members (lower(email));

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and status = 'actif');
$$;

-- ----------------------------------------------------------------------------
-- 3. CONTENUS PUBLICS
-- ----------------------------------------------------------------------------
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Annonce officielle',
  summary text,
  content text not null,
  image_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  conditions text,
  registration_required boolean not null default false,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'brouillon' check (status in ('brouillon','publie','annule')),
  image_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null,
  source text,
  file_path text,            -- chemin dans le bucket privé « resources »
  external_url text,
  access text not null default 'public' check (access in ('public','membres')),
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('stage','formation','emploi')),
  title text not null,
  organization text,
  description text,
  skills text,
  location text,
  deadline date,
  apply_url text,
  apply_email text,
  source_url text,
  is_verified boolean not null default false,
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('resource','opportunity')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'ouvert' check (status in ('ouvert','traite')),
  created_at timestamptz not null default now()
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  description text,
  nature text,
  website text,
  position integer not null default 0,
  is_published boolean not null default false,   -- à cocher UNIQUEMENT avec l'accord du partenaire
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partnership_requests (
  id uuid primary key default gen_random_uuid(),
  organisation text not null,
  contact_name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'nouveau' check (status in ('nouveau','traite')),
  created_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text,
  category text,
  event_label text,
  media_type text not null default 'photo' check (media_type in ('photo','video')),
  file_url text not null,
  taken_on date,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  position integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leaders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role_title text not null,
  bio text,
  responsibilities text,
  photo_url text,
  position integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.org_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  parent_id uuid references public.org_units(id) on delete set null,
  position integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. MESSAGERIE DE LA DIRECTION NATIONALE
-- ----------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  category text not null default 'autre',
  body text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'nouveau' check (status in ('nouveau','en_cours','en_attente','traite')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contact_messages_status_idx on public.contact_messages(status, created_at desc);

create table if not exists public.message_notes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.contact_messages(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_email text,
  kind text not null default 'note' check (kind in ('note','reponse')),
  body text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. NOTIFICATIONS ET JOURNAL
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS : horodatage, journalisation, notifications, capacité
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['news','events','resources','opportunities','partners','faq','leaders','org_units','site_settings','contact_messages'] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  insert into public.audit_logs(actor_id, actor_email, action, entity, entity_id, details)
  values (
    auth.uid(),
    (select u.email from auth.users u where u.id = auth.uid()),
    tg_op, tg_table_name,
    coalesce(r->>'id', concat_ws('/', r->>'user_id', r->>'role_key', r->>'permission', r->>'key')),
    jsonb_build_object(
      'label', coalesce(r->>'title', r->>'name', r->>'question', r->>'full_name', r->>'subject', r->>'organisation', r->>'label', r->>'role_key', r->>'key', r->>'last_name'),
      'status', coalesce(r->>'status', r->>'is_published')
    )
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['news','events','resources','opportunities','partners','gallery_items','faq','leaders','org_units','site_settings','members','roles','role_permissions','user_roles'] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.log_change()', t);
  end loop;
  -- Messages, demandes, signalements : le dépôt public (INSERT anonyme) n'est pas journalisé, seules les actions du personnel le sont
  foreach t in array array['contact_messages','membership_requests','message_notes','partnership_requests','content_reports'] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after update or delete on public.%I for each row execute function public.log_change()', t);
  end loop;
end $$;

-- Publication d'une actualité : date automatique + notification aux membres
create or replace function public.news_before() returns trigger
language plpgsql as $$
begin
  if new.is_published and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists trg_news_before on public.news;
create trigger trg_news_before before insert or update on public.news for each row execute function public.news_before();

create or replace function public.news_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_send boolean := false;
begin
  if tg_op = 'INSERT' then
    v_send := new.is_published;
  else
    v_send := new.is_published and not old.is_published;
  end if;
  if v_send then
    insert into public.notifications(user_id, title, body, link)
    select m.user_id, 'Nouvelle actualité', new.title, 'actualites.html?id=' || new.id
      from public.members m where m.user_id is not null and m.status = 'actif' and m.notify_news;
  end if;
  return new;
end $$;
drop trigger if exists trg_news_notify on public.news;
create trigger trg_news_notify after insert or update on public.news for each row execute function public.news_notify();

create or replace function public.events_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'publie' then
      insert into public.notifications(user_id, title, body, link)
      select m.user_id, 'Nouvel événement', new.title, 'evenements.html?id=' || new.id
        from public.members m where m.user_id is not null and m.status = 'actif' and m.notify_events;
    end if;
  else
    if new.status = 'publie' and old.status <> 'publie' then
      insert into public.notifications(user_id, title, body, link)
      select m.user_id, 'Nouvel événement', new.title, 'evenements.html?id=' || new.id
        from public.members m where m.user_id is not null and m.status = 'actif' and m.notify_events;
    elsif new.status = 'annule' and old.status <> 'annule' then
      insert into public.notifications(user_id, title, body, link)
      select r.user_id, 'Événement annulé', new.title, 'evenements.html?id=' || new.id
        from public.event_registrations r where r.event_id = new.id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_events_notify on public.events;
create trigger trg_events_notify after insert or update on public.events for each row execute function public.events_notify();

-- Capacité maximale d'un événement
create or replace function public.check_event_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap integer; cnt integer;
begin
  select capacity into cap from public.events where id = new.event_id;
  if cap is not null then
    select count(*) into cnt from public.event_registrations where event_id = new.event_id;
    if cnt >= cap then raise exception 'Cet événement est complet.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_capacity on public.event_registrations;
create trigger trg_capacity before insert on public.event_registrations for each row execute function public.check_event_capacity();

-- ----------------------------------------------------------------------------
-- 7. FONCTIONS PUBLIQUES (formulaires validés côté serveur, anti-abus)
-- ----------------------------------------------------------------------------
create or replace function public.submit_membership_request(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text; v_email text := lower(trim(coalesce(p->>'email','')));
begin
  if coalesce(trim(p->>'first_name'),'') = '' or coalesce(trim(p->>'last_name'),'') = '' then
    raise exception 'Le nom et le prénom sont obligatoires.'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Adresse e-mail invalide.'; end if;
  if coalesce((p->>'consent')::boolean, false) is not true then
    raise exception 'Vous devez accepter le traitement de vos données personnelles.'; end if;
  if exists (select 1 from public.members where lower(email) = v_email) then
    raise exception 'Cette adresse e-mail correspond déjà à un membre. Connectez-vous depuis la page Connexion.'; end if;
  if exists (select 1 from public.membership_requests where lower(email) = v_email and status in ('en_attente','en_cours')) then
    raise exception 'Une demande est déjà en cours d''examen pour cette adresse e-mail.'; end if;
  if (select count(*) from public.membership_requests where created_at > now() - interval '1 hour') >= 150 then
    raise exception 'Trop de demandes en ce moment. Réessayez dans une heure.'; end if;
  v_code := 'ADH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.membership_requests(code, first_name, last_name, email, phone, commune, level, institution, interest, motivation, consent)
  values (v_code, left(trim(p->>'first_name'),100), left(trim(p->>'last_name'),100), v_email,
          left(trim(coalesce(p->>'phone','')),40), left(trim(coalesce(p->>'commune','')),100),
          left(trim(coalesce(p->>'level','')),120), left(trim(coalesce(p->>'institution','')),200),
          left(trim(coalesce(p->>'interest','')),200), left(trim(coalesce(p->>'motivation','')),2000), true);
  return v_code;
end $$;

create or replace function public.track_membership_request(p_code text, p_email text)
returns table(status text, decision_note text, created_at timestamptz, first_name text)
language sql stable security definer set search_path = public as $$
  select r.status, r.decision_note, r.created_at, r.first_name
    from public.membership_requests r
   where r.code = upper(trim(p_code)) and lower(r.email) = lower(trim(p_email))
   limit 1;
$$;

create or replace function public.submit_contact_message(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text := lower(trim(coalesce(p->>'email','')));
begin
  if coalesce(trim(p->>'name'),'') = '' or coalesce(trim(p->>'subject'),'') = '' or coalesce(trim(p->>'body'),'') = '' then
    raise exception 'Merci de remplir le nom, l''objet et le message.'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Adresse e-mail invalide.'; end if;
  if (select count(*) from public.contact_messages where lower(email) = v_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Vous avez déjà envoyé plusieurs messages. Patientez avant de réessayer.'; end if;
  if (select count(*) from public.contact_messages where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Trop de messages en ce moment. Réessayez dans une heure.'; end if;
  insert into public.contact_messages(name, email, subject, category, body, user_id)
  values (left(trim(p->>'name'),150), v_email, left(trim(p->>'subject'),200),
          left(coalesce(nullif(trim(p->>'category'),''),'autre'),50), left(trim(p->>'body'),5000), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_partnership_request(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text := lower(trim(coalesce(p->>'email','')));
begin
  if coalesce(trim(p->>'organisation'),'') = '' or coalesce(trim(p->>'contact_name'),'') = '' then
    raise exception 'Merci d''indiquer l''organisation et le nom du contact.'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Adresse e-mail invalide.'; end if;
  if (select count(*) from public.partnership_requests where lower(email) = v_email and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Une demande a déjà été envoyée avec cette adresse. Patientez avant de réessayer.'; end if;
  insert into public.partnership_requests(organisation, contact_name, email, phone, message)
  values (left(trim(p->>'organisation'),200), left(trim(p->>'contact_name'),150), v_email,
          left(trim(coalesce(p->>'phone','')),40), left(trim(coalesce(p->>'message','')),3000))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.report_content(p_kind text, p_target uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('resource','opportunity') then raise exception 'Type invalide.'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Merci de préciser le motif du signalement.'; end if;
  if (select count(*) from public.content_reports where target_id = p_target and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Ce contenu a déjà été signalé. Merci, nous l''examinons.'; end if;
  insert into public.content_reports(kind, target_id, reason) values (p_kind, p_target, left(trim(p_reason),1000));
end $$;

-- Vérification publique d'une carte de membre (données minimales)
create or replace function public.verify_member(p_code text)
returns table(member_number text, first_name text, last_name text, status text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.member_number, m.first_name, m.last_name, m.status, m.joined_at
    from public.members m where m.verify_code = upper(trim(p_code)) limit 1;
$$;

-- Chiffres publics (aucune donnée personnelle)
create or replace function public.public_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'members', (select count(*) from public.members where status = 'actif'),
    'events', (select count(*) from public.events where status = 'publie'),
    'resources', (select count(*) from public.resources where is_published and access = 'public'),
    'opportunities', (select count(*) from public.opportunities where is_published)
  );
$$;

-- ----------------------------------------------------------------------------
-- 8. FONCTIONS RÉSERVÉES AUX MEMBRES CONNECTÉS
-- ----------------------------------------------------------------------------
-- Relie le compte (e-mail CONFIRMÉ) à la fiche membre créée lors de l'acceptation de la demande.
create or replace function public.claim_membership() returns boolean
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is null then return false; end if;
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then return false; end if;
  update public.members set user_id = auth.uid() where lower(email) = v_email and user_id is null;
  return exists (select 1 from public.members where user_id = auth.uid());
end $$;

create or replace function public.update_my_profile(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.members set
    phone = left(trim(coalesce(p->>'phone', phone, '')),40),
    commune = left(trim(coalesce(p->>'commune', commune, '')),100),
    level = left(trim(coalesce(p->>'level', level, '')),120),
    institution = left(trim(coalesce(p->>'institution', institution, '')),200),
    interest = left(trim(coalesce(p->>'interest', interest, '')),200),
    notify_news = coalesce((p->>'notify_news')::boolean, notify_news),
    notify_events = coalesce((p->>'notify_events')::boolean, notify_events)
  where user_id = auth.uid();
end $$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set is_read = true where user_id = auth.uid() and not is_read;
$$;

-- ----------------------------------------------------------------------------
-- 9. FONCTIONS D'ADMINISTRATION (permissions revérifiées côté serveur)
-- ----------------------------------------------------------------------------
create or replace function public.decide_membership_request(p_id uuid, p_decision text, p_note text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.membership_requests; v_num text;
begin
  if not public.has_perm('requests.manage') then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  if p_decision not in ('en_cours','accepte','refuse') then raise exception 'Décision invalide.'; end if;
  select * into r from public.membership_requests where id = p_id for update;
  if not found then raise exception 'Demande introuvable.'; end if;
  if r.status = 'accepte' then raise exception 'Cette demande a déjà été acceptée.'; end if;
  update public.membership_requests
     set status = p_decision, decision_note = left(p_note,1000), decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  if p_decision = 'accepte' then
    select member_number into v_num from public.members where lower(email) = lower(r.email);
    if v_num is null then
      v_num := 'GCU-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.member_seq')::text, 4, '0');
      insert into public.members(member_number, verify_code, first_name, last_name, email, phone, commune, level, institution, interest, request_id)
      values (v_num, upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)), r.first_name, r.last_name, lower(r.email), r.phone, r.commune, r.level, r.institution, r.interest, r.id);
    end if;
    return v_num;
  end if;
  return null;
end $$;

create or replace function public.admin_add_member(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_num text; v_email text := lower(trim(coalesce(p->>'email','')));
begin
  if not public.has_perm('members.manage') then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  if coalesce(trim(p->>'first_name'),'') = '' or coalesce(trim(p->>'last_name'),'') = '' or v_email = '' then
    raise exception 'Nom, prénom et e-mail sont obligatoires.'; end if;
  v_num := 'GCU-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.member_seq')::text, 4, '0');
  insert into public.members(member_number, verify_code, first_name, last_name, email, phone, commune, level, institution, interest)
  values (v_num, upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)), trim(p->>'first_name'), trim(p->>'last_name'), v_email,
          nullif(trim(coalesce(p->>'phone','')),''), nullif(trim(coalesce(p->>'commune','')),''), nullif(trim(coalesce(p->>'level','')),''),
          nullif(trim(coalesce(p->>'institution','')),''), nullif(trim(coalesce(p->>'interest','')),''));
  return v_num;
end $$;

create or replace function public.list_staff()
returns table(user_id uuid, email text, full_name text, roles text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name','')::text, array_agg(ur.role_key order by ur.role_key)
      from public.user_roles ur join auth.users u on u.id = ur.user_id
     group by u.id;
end $$;

create or replace function public.assign_role(p_email text, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if not public.has_perm('roles.manage') then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'Aucun compte avec cette adresse : la personne doit d''abord créer un compte sur la page Connexion.'; end if;
  insert into public.user_roles(user_id, role_key, assigned_by) values (v_uid, p_role, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.remove_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('roles.manage') then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  if p_role = 'admin_principal' and (select count(*) from public.user_roles where role_key = 'admin_principal') <= 1 then
    raise exception 'Impossible de retirer le dernier administrateur principal.'; end if;
  delete from public.user_roles where user_id = p_user and role_key = p_role;
end $$;

-- Droits d'exécution : tout est fermé par défaut, puis ouvert au strict nécessaire
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.submit_membership_request(jsonb), public.track_membership_request(text, text),
  public.submit_contact_message(jsonb), public.submit_partnership_request(jsonb), public.report_content(text, uuid, text),
  public.verify_member(text), public.public_stats() to anon, authenticated;
grant execute on function public.is_staff(), public.has_perm(text), public.is_member(), public.my_permissions(),
  public.claim_membership(), public.update_my_profile(jsonb), public.mark_notifications_read(),
  public.decide_membership_request(uuid, text, text), public.admin_add_member(jsonb),
  public.list_staff(), public.assign_role(text, text), public.remove_role(uuid, text) to authenticated;
-- (les politiques RLS appellent has_perm / is_member / is_staff : elles doivent aussi être exécutables par « anon »)
grant execute on function public.is_staff(), public.has_perm(text), public.is_member() to anon;

-- ----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['permissions','roles','role_permissions','user_roles','membership_requests','members','news','events','event_registrations',
    'resources','opportunities','content_reports','partners','partnership_requests','gallery_items','faq','leaders','org_units','site_settings',
    'contact_messages','message_notes','notifications','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Nettoyage : permet de relancer ce script sans erreur « policy already exists »
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Rôles / permissions
create policy perm_read on public.permissions for select using (public.is_staff());
create policy roles_read on public.roles for select using (public.is_staff());
create policy roles_write on public.roles for all using (public.has_perm('roles.manage')) with check (public.has_perm('roles.manage'));
create policy rp_read on public.role_permissions for select using (public.is_staff());
create policy rp_write on public.role_permissions for all using (public.has_perm('roles.manage')) with check (public.has_perm('roles.manage'));
create policy ur_read on public.user_roles for select using (user_id = auth.uid() or public.has_perm('roles.manage'));
-- (l'attribution / retrait de rôles passe par assign_role() et remove_role())

-- Adhésions et membres
create policy mr_all on public.membership_requests for all using (public.has_perm('requests.manage')) with check (public.has_perm('requests.manage'));
create policy members_own on public.members for select using (user_id = auth.uid());
create policy members_staff on public.members for all using (public.has_perm('members.manage')) with check (public.has_perm('members.manage'));

-- Actualités
create policy news_read on public.news for select using (is_published);
create policy news_write on public.news for all using (public.has_perm('news.manage')) with check (public.has_perm('news.manage'));

-- Événements et inscriptions
create policy events_read on public.events for select using (status in ('publie','annule'));
create policy events_write on public.events for all using (public.has_perm('events.manage')) with check (public.has_perm('events.manage'));
create policy er_read on public.event_registrations for select using (user_id = auth.uid() or public.has_perm('events.manage'));
create policy er_insert on public.event_registrations for insert with check (
  user_id = auth.uid() and public.is_member()
  and exists (select 1 from public.events e where e.id = event_id and e.status = 'publie' and e.starts_at > now()));
create policy er_delete on public.event_registrations for delete using (user_id = auth.uid() or public.has_perm('events.manage'));

-- Ressources
create policy res_read on public.resources for select using (is_published and (access = 'public' or public.is_member()));
create policy res_write on public.resources for all using (public.has_perm('resources.manage')) with check (public.has_perm('resources.manage'));

-- Opportunités
create policy opp_read on public.opportunities for select using (is_published);
create policy opp_write on public.opportunities for all using (public.has_perm('opportunities.manage')) with check (public.has_perm('opportunities.manage'));

-- Signalements (le dépôt se fait par report_content())
create policy rep_all on public.content_reports for all
  using (public.has_perm('resources.manage') or public.has_perm('opportunities.manage'))
  with check (public.has_perm('resources.manage') or public.has_perm('opportunities.manage'));

-- Partenaires
create policy partners_read on public.partners for select using (is_published);
create policy partners_write on public.partners for all using (public.has_perm('partners.manage')) with check (public.has_perm('partners.manage'));
create policy preq_all on public.partnership_requests for all using (public.has_perm('partners.manage')) with check (public.has_perm('partners.manage'));

-- Galerie, FAQ, organisation, dirigeants
create policy gal_read on public.gallery_items for select using (is_published);
create policy gal_write on public.gallery_items for all using (public.has_perm('gallery.manage')) with check (public.has_perm('gallery.manage'));
create policy faq_read on public.faq for select using (is_published);
create policy faq_write on public.faq for all using (public.has_perm('faq.manage')) with check (public.has_perm('faq.manage'));
create policy leaders_read on public.leaders for select using (is_published);
create policy leaders_write on public.leaders for all using (public.has_perm('org.manage')) with check (public.has_perm('org.manage'));
create policy units_read on public.org_units for select using (is_published);
create policy units_write on public.org_units for all using (public.has_perm('org.manage')) with check (public.has_perm('org.manage'));

-- Paramètres (lecture publique : n'y mettez JAMAIS de secret)
create policy set_read on public.site_settings for select using (true);
create policy set_write on public.site_settings for all using (public.has_perm('settings.manage')) with check (public.has_perm('settings.manage'));

-- Messagerie
create policy msg_all on public.contact_messages for all using (public.has_perm('messages.manage')) with check (public.has_perm('messages.manage'));
create policy notes_all on public.message_notes for all using (public.has_perm('messages.manage')) with check (public.has_perm('messages.manage'));

-- Notifications (lecture de ses propres notifications uniquement)
create policy notif_own on public.notifications for select using (user_id = auth.uid());

-- Journal
create policy logs_read on public.audit_logs for select using (public.has_perm('logs.view'));

-- ----------------------------------------------------------------------------
-- 11. STOCKAGE DES FICHIERS
--   media     : public en lecture (images d'actualités, galerie, photos, logos)
--   resources : PRIVÉ — téléchargement par lien signé selon les droits
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']),
  ('resources', 'resources', false, 52428800, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','image/jpeg','image/png'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_staff_write on storage.objects;
create policy media_staff_write on storage.objects for insert with check (bucket_id = 'media' and public.is_staff());
drop policy if exists media_staff_update on storage.objects;
create policy media_staff_update on storage.objects for update using (bucket_id = 'media' and public.is_staff());
drop policy if exists media_staff_delete on storage.objects;
create policy media_staff_delete on storage.objects for delete using (bucket_id = 'media' and public.is_staff());

drop policy if exists resources_read on storage.objects;
create policy resources_read on storage.objects for select using (
  bucket_id = 'resources' and (
    public.has_perm('resources.manage')
    or exists (select 1 from public.resources r
                where r.file_path = storage.objects.name and r.is_published
                  and (r.access = 'public' or public.is_member()))));
drop policy if exists resources_write on storage.objects;
create policy resources_write on storage.objects for insert with check (bucket_id = 'resources' and public.has_perm('resources.manage'));
drop policy if exists resources_update on storage.objects;
create policy resources_update on storage.objects for update using (bucket_id = 'resources' and public.has_perm('resources.manage'));
drop policy if exists resources_delete on storage.objects;
create policy resources_delete on storage.objects for delete using (bucket_id = 'resources' and public.has_perm('resources.manage'));

-- ----------------------------------------------------------------------------
-- 12. TEMPS RÉEL (alerte instantanée dans l'administration : nouveaux messages / demandes)
--     Le temps réel respecte la RLS : seul le personnel autorisé reçoit les événements.
-- ----------------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.contact_messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.membership_requests; exception when others then null; end;
end $$;
