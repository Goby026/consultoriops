-- Setup temporal para pruebas de Sesiones (se elimina al final)
delete from public.progress_note where tenant_id = 'faf62106-11cc-4936-9ea5-e02b1c6305fc';
delete from public.anamnesis where tenant_id = 'faf62106-11cc-4936-9ea5-e02b1c6305fc';
delete from public.session where tenant_id = 'faf62106-11cc-4936-9ea5-e02b1c6305fc';
delete from public.informed_consent where tenant_id = 'faf62106-11cc-4936-9ea5-e02b1c6305fc' and patient_id in (select id from public.patient where identity_doc_number = 'SESSIONTEST001');
delete from public.appointment where tenant_id = 'faf62106-11cc-4936-9ea5-e02b1c6305fc' and patient_id in (select id from public.patient where identity_doc_number = 'SESSIONTEST001');
delete from public.patient where tenant_id = 'faf62106-11cc-4936-9ea5-e02b1c6305fc' and identity_doc_number = 'SESSIONTEST001';
delete from public.tenant_membership where user_id in (select id from auth.users where email in ('sesspro@test.com','sessadmin@test.com','sessother@test.com'));
delete from auth.users where email in ('sesspro@test.com','sessadmin@test.com','sessother@test.com');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id, raw_user_meta_data)
values
  (gen_random_uuid(), 'sesspro@test.com',    crypt('Password123!', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '{"full_name":"Prof Prueba"}'),
  (gen_random_uuid(), 'sessadmin@test.com',  crypt('Password123!', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '{"full_name":"Admin Prueba"}'),
  (gen_random_uuid(), 'sessother@test.com',  crypt('Password123!', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '{"full_name":"Otra Prof"}');

update public.user_profile set full_name = 'Prof Prueba' where id = (select id from auth.users where email = 'sesspro@test.com');
update public.user_profile set full_name = 'Admin Prueba' where id = (select id from auth.users where email = 'sessadmin@test.com');
update public.user_profile set full_name = 'Otra Prof' where id = (select id from auth.users where email = 'sessother@test.com');

insert into public.tenant_membership (tenant_id, user_id, role_id, status)
select 'faf62106-11cc-4936-9ea5-e02b1c6305fc', u.id, r.id, 'active'
from auth.users u
join public.role r on r.code = 'professional'
where u.email in ('sesspro@test.com','sessother@test.com');

insert into public.tenant_membership (tenant_id, user_id, role_id, status)
select 'faf62106-11cc-4936-9ea5-e02b1c6305fc', u.id, r.id, 'active'
from auth.users u
join public.role r on r.code = 'tenant_admin'
where u.email = 'sessadmin@test.com';

insert into public.patient (tenant_id, first_name, last_name, birth_date, gender, identity_doc_type, identity_doc_number, phone)
values ('faf62106-11cc-4936-9ea5-e02b1c6305fc', 'Prueba', 'Sesiones', '1990-05-10', 'female', 'DNI', 'SESSIONTEST001', '999000111');

insert into public.appointment (tenant_id, patient_id, professional_id, service_id, scheduled_at, status, attendance)
select 'faf62106-11cc-4936-9ea5-e02b1c6305fc', p.id, u.id, s.id, '2026-08-17T13:00:00Z', 'ATENDIDA', 'PRESENT'
from public.patient p
join auth.users u on u.email = 'sesspro@test.com'
join public.service s on s.tenant_id = 'faf62106-11cc-4936-9ea5-e02b1c6305fc' and s.name = 'Terapia Individual'
where p.identity_doc_number = 'SESSIONTEST001';

insert into public.appointment (tenant_id, patient_id, professional_id, service_id, scheduled_at, status)
select 'faf62106-11cc-4936-9ea5-e02b1c6305fc', p.id, u.id, s.id, '2026-08-18T13:00:00Z', 'PROGRAMADA'
from public.patient p
join auth.users u on u.email = 'sesspro@test.com'
join public.service s on s.tenant_id = 'faf62106-11cc-4936-9ea5-e02b1c6305fc' and s.name = 'Terapia Individual'
where p.identity_doc_number = 'SESSIONTEST001';

select u.id as pro_id from auth.users u where u.email = 'sesspro@test.com';
select p.id as patient_id from public.patient p where p.identity_doc_number = 'SESSIONTEST001';
select a.id, a.status from public.appointment a
where a.tenant_id = 'faf62106-11cc-4936-9ea5-e02b1c6305fc'
  and a.patient_id in (select id from public.patient where identity_doc_number = 'SESSIONTEST001')
order by a.scheduled_at;
