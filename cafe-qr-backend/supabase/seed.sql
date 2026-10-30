-- =============================================================================
-- Café QR (V1) : seed.sql (DÉVELOPPEMENT LOCAL UNIQUEMENT)
-- Appliqué par `supabase db reset`. Ne jamais exécuter en production :
-- mots de passe et jetons de QR sont volontairement prévisibles pour les tests.
--
-- Comptes (mot de passe commun : Password123!)
--   owner-a@cafe-a.test   patron du Café A      waiter-a@cafe-a.test  serveur du Café A
--   owner-b@cafe-b.test   patron du Café B      waiter-b@cafe-b.test  serveur du Café B
--   client1@example.test  abonné Café A         client2@example.test  désabonné Café A
--   client3@example.test  abonné Café B
--   client4@example.test  NON CONFIRMÉ : ne doit recevoir aucune annonce
-- Jetons de table : Café A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa000N' (N = 1..5)
--                   Café B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb000N'
-- =============================================================================

-- Cafés
insert into public.cafes (id, name, slug, currency) values
  ('a0000000-0000-4000-8000-000000000001', 'Café A', 'cafe-a', 'EUR'),
  ('b0000000-0000-4000-8000-000000000001', 'Café B', 'cafe-b', 'EUR');

-- Utilisateurs Auth (le trigger crée les lignes customers / cafe_followers des clients)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000a001', 'authenticated', 'authenticated', 'owner-a@cafe-a.test',
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"signup_type":"staff"}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a001',
  jsonb_build_object('sub', '00000000-0000-4000-8000-00000000a001', 'email', 'owner-a@cafe-a.test', 'email_verified', true), 'email', now(), now(), now());

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000a002', 'authenticated', 'authenticated', 'waiter-a@cafe-a.test',
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"signup_type":"staff"}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000a002',
  jsonb_build_object('sub', '00000000-0000-4000-8000-00000000a002', 'email', 'waiter-a@cafe-a.test', 'email_verified', true), 'email', now(), now(), now());

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b001', 'authenticated', 'authenticated', 'owner-b@cafe-b.test',
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"signup_type":"staff"}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b001',
  jsonb_build_object('sub', '00000000-0000-4000-8000-00000000b001', 'email', 'owner-b@cafe-b.test', 'email_verified', true), 'email', now(), now(), now());

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b002', 'authenticated', 'authenticated', 'waiter-b@cafe-b.test',
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"signup_type":"staff"}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000b002',
  jsonb_build_object('sub', '00000000-0000-4000-8000-00000000b002', 'email', 'waiter-b@cafe-b.test', 'email_verified', true), 'email', now(), now(), now());

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000c001', 'authenticated', 'authenticated', 'client1@example.test',
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"signup_type":"customer","cafe_slug":"cafe-a","display_name":"Client 1","newsletter_opt_in":true}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c001',
  jsonb_build_object('sub', '00000000-0000-4000-8000-00000000c001', 'email', 'client1@example.test', 'email_verified', true), 'email', now(), now(), now());

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000c002', 'authenticated', 'authenticated', 'client2@example.test',
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"signup_type":"customer","cafe_slug":"cafe-a","display_name":"Client 2 (désabonné)"}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000c002',
  jsonb_build_object('sub', '00000000-0000-4000-8000-00000000c002', 'email', 'client2@example.test', 'email_verified', true), 'email', now(), now(), now());

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000c003', 'authenticated', 'authenticated', 'client3@example.test',
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"signup_type":"customer","cafe_slug":"cafe-b","display_name":"Client 3","newsletter_opt_in":true}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000c003',
  jsonb_build_object('sub', '00000000-0000-4000-8000-00000000c003', 'email', 'client3@example.test', 'email_verified', true), 'email', now(), now(), now());

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000c004', 'authenticated', 'authenticated', 'client4@example.test',
  extensions.crypt('Password123!', extensions.gen_salt('bf')), null,
  '{"provider":"email","providers":["email"]}', '{"signup_type":"customer","cafe_slug":"cafe-a","display_name":"Client 4 (non confirmé)","newsletter_opt_in":true}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-00000000c004',
  jsonb_build_object('sub', '00000000-0000-4000-8000-00000000c004', 'email', 'client4@example.test', 'email_verified', true), 'email', now(), now(), now());

-- Employés
insert into public.staff_members (id, cafe_id, role, display_name) values
  ('00000000-0000-4000-8000-00000000a001', 'a0000000-0000-4000-8000-000000000001', 'owner', 'Patron A'),
  ('00000000-0000-4000-8000-00000000a002', 'a0000000-0000-4000-8000-000000000001', 'waiter', 'Serveur A'),
  ('00000000-0000-4000-8000-00000000b001', 'b0000000-0000-4000-8000-000000000001', 'owner', 'Patron B'),
  ('00000000-0000-4000-8000-00000000b002', 'b0000000-0000-4000-8000-000000000001', 'waiter', 'Serveur B');

-- Client 2 : désabonné du Café A (ne doit rien recevoir)
update public.cafe_followers set notifications_opt_in = false, unsubscribed_at = now()
where customer_id = '00000000-0000-4000-8000-00000000c002' and cafe_id = 'a0000000-0000-4000-8000-000000000001';

-- ===== Café A =====
insert into public.cafe_tables (id, cafe_id, label, qr_token) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '1', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0001'),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '2', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0002'),
  ('a3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', '3', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0003'),
  ('a3000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', '4', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0004'),
  ('a3000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', '5', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0005');

insert into public.categories (id, cafe_id, name, position) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Boissons chaudes', 1),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Boissons fraîches', 2),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Pâtisseries', 3);

insert into public.products (id, cafe_id, category_id, name, description, price_cents, is_available, is_promoted, promo_label, position) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Espresso', 'Café serré, torréfaction artisanale', 180, true, false, null, 1),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Café allongé', null, 220, true, false, null, 2),
  ('a2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Cappuccino', 'Espresso, lait moussé, cacao', 350, true, true, 'Offre du moment', 3),
  ('a2000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Chocolat chaud', null, 380, true, false, null, 4),
  ('a2000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Jus d''orange pressé', null, 450, true, false, null, 5),
  ('a2000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Limonade maison', null, 400, true, false, null, 6),
  ('a2000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Thé glacé', 'Indisponible pour les tests', 380, false, false, null, 7),
  ('a2000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'Croissant', null, 150, true, false, null, 8),
  ('a2000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'Pain au chocolat', null, 170, true, false, null, 9),
  ('a2000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'Cookie', 'Pépites de chocolat noir', 250, true, false, null, 10);

insert into public.announcements (id, cafe_id, title, body, created_by) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Nouveau : brunch le dimanche', 'Dès ce week-end, brunch maison de 10 h à 14 h. Réservez votre table !', '00000000-0000-4000-8000-00000000a001');

-- ===== Café B =====
insert into public.cafe_tables (id, cafe_id, label, qr_token) values
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '1', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0001'),
  ('b3000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', '2', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0002'),
  ('b3000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', '3', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0003'),
  ('b3000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', '4', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0004'),
  ('b3000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', '5', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0005');

insert into public.categories (id, cafe_id, name, position) values
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Boissons chaudes', 1),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Boissons fraîches', 2),
  ('b1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Pâtisseries', 3);

insert into public.products (id, cafe_id, category_id, name, description, price_cents, is_available, is_promoted, promo_label, position) values
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Espresso', 'Café serré, torréfaction artisanale', 180, true, false, null, 1),
  ('b2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Café allongé', null, 220, true, false, null, 2),
  ('b2000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Cappuccino', 'Espresso, lait moussé, cacao', 350, true, true, 'Offre du moment', 3),
  ('b2000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Chocolat chaud', null, 380, true, false, null, 4),
  ('b2000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Jus d''orange pressé', null, 450, true, false, null, 5),
  ('b2000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Limonade maison', null, 400, true, false, null, 6),
  ('b2000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Thé glacé', 'Indisponible pour les tests', 380, false, false, null, 7),
  ('b2000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'Croissant', null, 150, true, false, null, 8),
  ('b2000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'Pain au chocolat', null, 170, true, false, null, 9),
  ('b2000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'Cookie', 'Pépites de chocolat noir', 250, true, false, null, 10);

insert into public.announcements (id, cafe_id, title, body, created_by) values
  ('b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Nouveau : brunch le dimanche', 'Dès ce week-end, brunch maison de 10 h à 14 h. Réservez votre table !', '00000000-0000-4000-8000-00000000b001');
