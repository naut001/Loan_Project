-- =====================================================================
-- Sổ trả nợ: lược đồ Supabase
-- Chạy trong SQL Editor của dự án Supabase. Chạy lại nhiều lần vẫn an toàn.
-- Mỗi tài khoản có đúng một hàng chứa toàn bộ dữ liệu; RLS đảm bảo
-- tài khoản nào chỉ đọc và ghi được hàng của chính mình.
-- =====================================================================

-- Bảng cũ (theo device_id) không còn dùng, xoá để không để lại chính sách yếu.
drop table if exists public.user_state cascade;

create table if not exists public.user_data (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  payload    jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint payload_max_1mb   check (octet_length(payload::text) <= 1048576)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_data_updated_at on public.user_data;
create trigger trg_user_data_updated_at
  before update on public.user_data
  for each row execute function public.set_updated_at();

-- Khoá quyền: người chưa đăng nhập (anon) không đụng được vào bảng.
alter table public.user_data enable row level security;
revoke all on public.user_data from anon;
grant select, insert, update on public.user_data to authenticated;

drop policy if exists "user_select" on public.user_data;
drop policy if exists "user_insert" on public.user_data;
drop policy if exists "user_update" on public.user_data;

create policy "user_select" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "user_insert" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "user_update" on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Không có policy delete: dữ liệu chỉ bị xoá khi xoá tài khoản (on delete cascade).
