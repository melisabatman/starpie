-- =============================================
-- Starpie — Grup Sohbeti (Group Chat) Sistemi SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. groups tablosunu oluştur
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null check (char_length(trim(name)) > 0 and char_length(name) <= 100),
  description text check (description is null or char_length(description) <= 500),
  avatar_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- 2. group_members tablosunu oluştur
create table if not exists public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('admin', 'member')) default 'member',
  joined_at timestamp with time zone default now() not null,

  -- Bir kullanıcı bir grupta yalnızca bir kez üye olabilir
  constraint unique_group_member unique (group_id, user_id)
);

-- 3. group_messages tablosunu oluştur
create table if not exists public.group_messages (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  content text check (content is null or (char_length(trim(content)) > 0 and char_length(content) <= 2000)),
  message_type text default 'text' check (message_type in ('text', 'audio')),
  audio_url text,
  created_at timestamp with time zone default now() not null,

  -- Mesaj içeriği veya ses dosyası olmak zorunda
  constraint group_message_content_check check (
    (message_type = 'text' and content is not null) or
    (message_type = 'audio' and audio_url is not null)
  )
);

-- 4. Index'ler (Hızlı sorgulama, üyelik kontrolü ve sohbet akışı performansı)
create index if not exists groups_created_by_idx on public.groups(created_by);
create index if not exists groups_updated_at_idx on public.groups(updated_at desc);

create index if not exists group_members_group_id_idx on public.group_members(group_id);
create index if not exists group_members_user_id_idx on public.group_members(user_id);
create index if not exists group_members_role_idx on public.group_members(role);

create index if not exists group_messages_group_id_idx on public.group_messages(group_id);
create index if not exists group_messages_sender_id_idx on public.group_messages(sender_id);
create index if not exists group_messages_created_at_idx on public.group_messages(created_at asc);

-- 5. Güvenlik Yardımcı Fonksiyonları (RLS özyinelemesini önlemek için SECURITY DEFINER kullanılır)
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id and role = 'admin'
  );
$$;

-- 6. Row Level Security (RLS) aktif et
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

-- 7. RLS Politikaları — groups
-- SELECT: Yalnızca grubun üyesi veya grubu oluşturan kullanıcılar görebilir
create policy "Group members can view groups"
  on public.groups for select
  using (created_by = auth.uid() or public.is_group_member(id, auth.uid()));

-- INSERT: Giriş yapmış kullanıcılar yeni grup oluşturabilir
create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.role() = 'authenticated' and auth.uid() = created_by);

-- UPDATE: Yalnızca grup yöneticileri (admin) grup bilgilerini değiştirebilir
create policy "Group admins can update group info"
  on public.groups for update
  using (public.is_group_admin(id, auth.uid()))
  with check (public.is_group_admin(id, auth.uid()));

-- DELETE: Yalnızca grup yöneticileri (admin) grubu silebilir
create policy "Group admins can delete groups"
  on public.groups for delete
  using (public.is_group_admin(id, auth.uid()));

-- 8. RLS Politikaları — group_members
-- SELECT: Kullanıcı kendi üyeliğini veya üyesi olduğu grubun diğer üyelerini görebilir
create policy "Members can view other members of their groups"
  on public.group_members for select
  using (
    user_id = auth.uid()
    or public.is_group_member(group_id, auth.uid())
  );

-- INSERT: Grup admini yeni üye ekleyebilir; ya da grup oluşturucu ilk üyeleri ekleyebilir
create policy "Admins or creators can add group members"
  on public.group_members for insert
  with check (
    auth.role() = 'authenticated'
    and (
      public.is_group_admin(group_id, auth.uid())
      or exists (
        select 1 from public.groups g
        where g.id = group_members.group_id and g.created_by = auth.uid()
      )
    )
  );

-- UPDATE: Yalnızca grup yöneticisi üye rolünü değiştirebilir
create policy "Admins can update member roles"
  on public.group_members for update
  using (public.is_group_admin(group_id, auth.uid()))
  with check (public.is_group_admin(group_id, auth.uid()));

-- DELETE: Üye kendisi gruptan ayrılabilir VEYA yönetici başka bir üyeyi çıkarabilir
create policy "Members can leave or admins can remove members"
  on public.group_members for delete
  using (
    auth.uid() = user_id
    or public.is_group_admin(group_id, auth.uid())
  );

-- 9. RLS Politikaları — group_messages
-- SELECT: Yalnızca grup üyeleri gruptaki mesajları okuyabilir
create policy "Group members can view group messages"
  on public.group_messages for select
  using (public.is_group_member(group_id, auth.uid()));

-- INSERT: Yalnızca grup üyeleri kendi adlarına mesaj gönderebilir
create policy "Group members can send messages"
  on public.group_messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_group_member(group_id, auth.uid())
  );

-- DELETE: Gönderen kendi mesajını veya grup admini herhangi bir mesajı silebilir
create policy "Senders or admins can delete group messages"
  on public.group_messages for delete
  using (
    auth.uid() = sender_id
    or public.is_group_admin(group_id, auth.uid())
  );

-- =============================================
-- 10. Supabase Realtime Yapılandırması
-- =============================================
alter table public.group_messages replica identity full;
alter table public.groups replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'groups'
  ) then
    alter publication supabase_realtime add table public.groups;
  end if;
end $$;

-- =============================================
-- 11. Storage Bucket: "group-photos"
-- =============================================
insert into storage.buckets (id, name, public)
values ('group-photos', 'group-photos', true)
on conflict (id) do update set public = true;

create policy "Group photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'group-photos');

create policy "Authenticated users can upload group photos"
  on storage.objects for insert
  with check (
    bucket_id = 'group-photos'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can update group photos"
  on storage.objects for update
  using (
    bucket_id = 'group-photos'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can delete group photos"
  on storage.objects for delete
  using (
    bucket_id = 'group-photos'
    and auth.role() = 'authenticated'
  );
