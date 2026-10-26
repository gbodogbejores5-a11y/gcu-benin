-- ============================================================================
-- GCU-BÉNIN — Données initiales (rôles, permissions, FAQ, structure de l'organisation)
-- À exécuter APRÈS 01_schema.sql. Peut être relancé sans danger.
-- Tout ce contenu est modifiable ensuite depuis l'administration.
-- ============================================================================

-- Permissions
insert into public.permissions (key, label) values
  ('requests.manage',      'Demandes d''adhésion (examiner, accepter, refuser)'),
  ('members.manage',       'Membres (profils, statuts, suspension)'),
  ('news.manage',          'Actualités'),
  ('events.manage',        'Événements et inscriptions'),
  ('resources.manage',     'Ressources et documentation'),
  ('opportunities.manage', 'Stages, formations et emplois'),
  ('partners.manage',      'Partenaires et demandes de partenariat'),
  ('gallery.manage',       'Galerie photos / vidéos'),
  ('faq.manage',           'Questions fréquentes'),
  ('org.manage',           'Organisation et équipe dirigeante'),
  ('messages.manage',      'Messagerie de la Direction nationale'),
  ('roles.manage',         'Rôles et permissions du personnel'),
  ('settings.manage',      'Paramètres du site (coordonnées, réseaux)'),
  ('logs.view',            'Journal des actions')
on conflict (key) do update set label = excluded.label;

-- Rôles (configurables ensuite depuis l'administration)
insert into public.roles (key, label, description, is_system) values
  ('admin_principal',     'Administrateur principal',   'Accès total. Ne peut pas être restreint.', true),
  ('admin_technique',     'Administrateur technique',   'Paramètres du site et journal des actions.', false),
  ('resp_communication',  'Responsable de la communication', 'Actualités, événements, galerie, FAQ et partenaires.', false),
  ('resp_adhesions',      'Responsable des adhésions',  'Demandes d''adhésion et gestion des membres.', false),
  ('resp_ressources',     'Responsable des ressources', 'Documentation et signalements de documents.', false),
  ('resp_opportunites',   'Responsable des opportunités','Stages, formations et emplois.', false),
  ('resp_messagerie',     'Responsable de la messagerie','Boîte de réception de la Direction nationale.', false)
on conflict (key) do nothing;

insert into public.role_permissions (role_key, permission) values
  ('admin_technique','settings.manage'), ('admin_technique','logs.view'),
  ('resp_communication','news.manage'), ('resp_communication','events.manage'), ('resp_communication','gallery.manage'),
  ('resp_communication','faq.manage'), ('resp_communication','partners.manage'),
  ('resp_adhesions','requests.manage'), ('resp_adhesions','members.manage'),
  ('resp_ressources','resources.manage'),
  ('resp_opportunites','opportunities.manage'),
  ('resp_messagerie','messages.manage')
on conflict do nothing;

-- Paramètres du site (vides tant que les comptes / coordonnées ne sont pas officiels)
insert into public.site_settings (key, value) values
  ('contact_email',''), ('contact_phone',''), ('contact_address',''),
  ('social_facebook',''), ('social_whatsapp',''), ('social_instagram',''), ('social_linkedin',''), ('social_youtube','')
on conflict (key) do nothing;

-- Structure de l'organisation (descriptions génériques à ajuster selon les statuts)
insert into public.org_units (id, name, description, parent_id, position) values
  ('00000000-0000-4000-8000-000000000001', 'Assemblée générale',
   'Rassemble les membres de GCU-BÉNIN. Sa composition, ses réunions et ses attributions sont précisées par les statuts.', null, 1),
  ('00000000-0000-4000-8000-000000000002', 'Direction nationale',
   'Organe de direction au niveau national : coordination générale, représentation de la communauté et mise en œuvre des orientations. Ses responsables sont présentés après leur désignation officielle.', '00000000-0000-4000-8000-000000000001', 1),
  ('00000000-0000-4000-8000-000000000003', 'Coordinations locales',
   'Relais de GCU-BÉNIN dans les communes et régions : animation de la communauté locale, accueil des nouveaux membres et relais des activités nationales.', '00000000-0000-4000-8000-000000000002', 1),
  ('00000000-0000-4000-8000-000000000004', 'Commissions techniques ou spécialisées',
   'Groupes de travail thématiques (ressources, événements, opportunités, communication…) chargés de préparer et de mener des actions précises.', '00000000-0000-4000-8000-000000000002', 2)
on conflict (id) do nothing;

-- Questions fréquentes (réponses modifiables dans l'administration)
insert into public.faq (id, question, answer, position) values
  ('00000000-0000-4000-8000-0000000000a1', 'Qu''est-ce que GCU-BÉNIN ?',
   'GÉNIE CIVIL UNIS — BÉNIN (GCU-BÉNIN) est un projet de communauté qui rassemble les élèves, les étudiants, les techniciens, les ingénieurs et toutes les personnes intéressées par le génie civil au Bénin, afin de partager les connaissances et de développer les compétences.', 1),
  ('00000000-0000-4000-8000-0000000000a2', 'Quels sont ses objectifs ?',
   'Rassembler les passionnés du génie civil, favoriser le partage de connaissances, organiser des rencontres et des ateliers, faciliter l''accès aux informations sur les formations, les stages et les emplois, et valoriser les métiers du bâtiment et des travaux publics. Le détail est présenté sur la page « À propos ».', 2),
  ('00000000-0000-4000-8000-0000000000a3', 'Qui peut rejoindre la communauté ?',
   'Les élèves des filières techniques, les étudiants en génie civil et domaines associés, les techniciens, les ingénieurs, les architectes, les enseignants et formateurs, les professionnels de la construction et toute personne intéressée par les objectifs de la communauté, selon les conditions définies par les statuts.', 3),
  ('00000000-0000-4000-8000-0000000000a4', 'Comment soumettre une demande d''adhésion ?',
   'Rendez-vous sur la page « Adhésion » et remplissez le formulaire. Vous recevez un code de suivi qui permet de consulter l''état de votre demande (en attente, en cours d''examen, acceptée ou refusée). Après acceptation, vous créez votre compte avec la même adresse e-mail pour accéder à votre espace membre.', 4),
  ('00000000-0000-4000-8000-0000000000a5', 'L''adhésion est-elle payante ?',
   'Aucune cotisation ni frais d''adhésion n''est annoncé à ce jour. Si des règles à ce sujet sont adoptées, elles seront communiquées officiellement sur ce site. Méfiez-vous de toute demande d''argent faite au nom de GCU-BÉNIN en dehors des canaux officiels.', 5),
  ('00000000-0000-4000-8000-0000000000a6', 'Comment accéder aux ressources ?',
   'Une partie de la documentation est publique, une autre est réservée aux membres. Rendez-vous sur la page « Ressources » ; pour les documents réservés, connectez-vous à votre espace membre.', 6),
  ('00000000-0000-4000-8000-0000000000a7', 'Comment participer aux événements ?',
   'Consultez la page « Événements ». Lorsque l''inscription est nécessaire, connectez-vous à votre espace membre et cliquez sur « S''inscrire ». Une confirmation s''affiche et l''événement apparaît dans votre espace.', 7),
  ('00000000-0000-4000-8000-0000000000a8', 'Comment proposer un partenariat ?',
   'Utilisez le formulaire en bas de la page « Partenaires ». Votre demande est transmise aux responsables autorisés. Un organisme n''est présenté comme partenaire officiel qu''avec son accord.', 8),
  ('00000000-0000-4000-8000-0000000000a9', 'Comment signaler une offre suspecte ?',
   'Chaque offre de la page « Opportunités » dispose d''un bouton « Signaler ». Indiquez le motif : l''offre sera examinée et, si besoin, retirée. GCU-BÉNIN ne garantit pas une offre dont l''authenticité n''a pas été confirmée.', 9),
  ('00000000-0000-4000-8000-0000000000b0', 'Comment contacter la Direction nationale ?',
   'Écrivez-nous depuis la page « Contact ». Votre message est enregistré et transmis aux responsables autorisés, qui vous répondront dans les meilleurs délais.', 10)
on conflict (id) do nothing;

-- Les insertions ci-dessus ne viennent d'aucun utilisateur : on les retire du journal d'actions
-- pour que le journal ne montre que les actions réelles du personnel.
delete from public.audit_logs
 where actor_id is null and created_at > now() - interval '10 minutes'
   and entity in ('roles','role_permissions','site_settings','org_units','faq');
