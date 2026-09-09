-- ──────────────────────────────────────────────────────────────────────────────
-- STARPIE — 5 YENİ ÖZELLİK SQL MİGRASYONU
-- 1. blocked_users (Engellenen Kullanıcılar)
-- 2. reports (Şikayetler & Moderasyon)
-- 3. notifications (Uygulama İçi Bildirimler & Realtime)
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. ENGELLENEN KULLANICILAR TABLOSU
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  constraint blocked_users_unique unique(blocker_id, blocked_id),
  constraint blocked_users_no_self check(blocker_id <> blocked_id)
);

create index if not exists idx_blocked_users_blocker on public.blocked_users(blocker_id);
create index if not exists idx_blocked_users_blocked on public.blocked_users(blocked_id);

alter table public.blocked_users enable row level security;

drop policy if exists "Users can view their own blocks" on public.blocked_users;
create policy "Users can view their own blocks"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

drop policy if exists "Users can block other users" on public.blocked_users;
create policy "Users can block other users"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

drop policy if exists "Users can unblock users" on public.blocked_users;
create policy "Users can unblock users"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);


-- 2. ŞİKAYETLER & MODERASYON TABLOSU
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('user', 'post', 'comment')),
  target_id text not null,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'resolved')),
  created_at timestamptz default now()
);

create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_created on public.reports(created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can view their own reports or admins" on public.reports;
create policy "Users can view their own reports or admins"
  on public.reports for select
  using (
    auth.uid() = reporter_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
  on public.reports for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Admins can delete reports" on public.reports;
create policy "Admins can delete reports"
  on public.reports for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );


-- 3. UYGULAMA İÇİ BİLDİRİMLER TABLOSU
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('friend_request', 'friend_accept', 'new_message', 'post_like', 'post_comment', 'timeline_post')),
  entity_id text,
  content text,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read);
create index if not exists idx_notifications_created on public.notifications(created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can insert notifications" on public.notifications;
create policy "Users can insert notifications"
  on public.notifications for insert
  with check (auth.uid() = actor_id and actor_id <> user_id);

-- Realtime için notifications tablosunu yayına ekle
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
