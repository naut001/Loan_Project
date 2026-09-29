-- Run AFTER schema.sql on a new project; run directly on existing 1.3 projects.
-- Additive migration: no payload rewriting, no table drops. Entirely transactional.
begin;
set local lock_timeout = '5s';

alter table public.user_data add column if not exists revision bigint not null default 1;

create table if not exists public.user_data_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  payload jsonb not null,
  saved_at timestamptz not null,
  archived_at timestamptz not null default clock_timestamp(),
  primary key (user_id, revision)
);
alter table public.user_data_history enable row level security;
revoke all on public.user_data_history from public, anon, authenticated;
grant select on public.user_data_history to authenticated;
drop policy if exists history_own_read on public.user_data_history;
create policy history_own_read on public.user_data_history
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists history_account_boundary on public.user_data_history;
create policy history_account_boundary on public.user_data_history as restrictive
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Trigger-only privileged function: browser users cannot insert/delete history.
create or replace function public.archive_user_data()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Changing data ownership is not allowed' using errcode = '42501';
  end if;
  insert into public.user_data_history(user_id, revision, payload, saved_at)
    values (old.user_id, old.revision, old.payload, old.updated_at)
    on conflict (user_id, revision) do nothing;
  new.revision := old.revision + 1;
  -- Retain the last 20 prior versions per account, in the same transaction.
  delete from public.user_data_history
    where user_id = old.user_id and revision not in (
      select h.revision from public.user_data_history h
      where h.user_id = old.user_id order by h.revision desc limit 20
    );
  return new;
end;
$$;
revoke all on function public.archive_user_data() from public, anon, authenticated;
drop trigger if exists trg_user_data_history on public.user_data;
create trigger trg_user_data_history before update on public.user_data
  for each row execute function public.archive_user_data();

-- Monotonic timestamp makes the current frontend's conditional PATCH reliable.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
drop trigger if exists trg_user_data_updated_at on public.user_data;
create trigger trg_user_data_updated_at before update on public.user_data
  for each row execute function public.set_updated_at();

-- Retain the existing account boundary, including for clients predating v2.
alter table public.user_data enable row level security;
revoke all on public.user_data from public, anon;
revoke delete, truncate, references, trigger on public.user_data from authenticated;
grant select, insert, update on public.user_data to authenticated;
-- Re-establish the named account policies from schema.sql.
drop policy if exists user_select on public.user_data;
drop policy if exists user_insert on public.user_data;
drop policy if exists user_update on public.user_data;
create policy user_select on public.user_data for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_insert on public.user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_update on public.user_data for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Restrictive guard also bounds any permissive custom policies already present.
drop policy if exists account_boundary on public.user_data;
create policy account_boundary on public.user_data as restrictive for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;