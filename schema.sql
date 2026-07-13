-- دليل آية V4 — جدول الحفظ والمزامنة
create table if not exists public.aya_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.aya_user_data enable row level security;

drop policy if exists "Users can read own Aya data" on public.aya_user_data;
create policy "Users can read own Aya data"
on public.aya_user_data for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own Aya data" on public.aya_user_data;
create policy "Users can insert own Aya data"
on public.aya_user_data for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own Aya data" on public.aya_user_data;
create policy "Users can update own Aya data"
on public.aya_user_data for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_aya_user_data_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aya_user_data_set_updated_at on public.aya_user_data;
create trigger aya_user_data_set_updated_at
before update on public.aya_user_data
for each row execute function public.set_aya_user_data_updated_at();
