-- Read-only checks. Run after migration in the Supabase SQL Editor.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('user_data', 'user_data_history');
select tablename, policyname, roles, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename in ('user_data', 'user_data_history');
select trigger_name, event_manipulation, action_statement from information_schema.triggers
where event_object_schema = 'public' and event_object_table = 'user_data';
select column_name, data_type, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'user_data';
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('user_data', 'user_data_history')
  and grantee in ('anon', 'authenticated', 'PUBLIC');
-- Counts only: do not publish user payloads or IDs in diagnostics.
select count(*) as accounts, min(revision) as min_revision from public.user_data;
select count(*) as archived_versions from public.user_data_history;