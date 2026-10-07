-- Run this entire file once in a new Supabase project's SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 40),
  name_key text generated always as (lower(trim(name))) stored unique,
  is_roommate boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  week_end date not null,
  candidate_id uuid not null references public.candidates(id),
  author_name text not null check (author_name in ('Jacob', 'Will', 'Brandon', 'Cole', 'Tommy', 'Xan')),
  title text not null check (length(trim(title)) between 2 and 100),
  body text not null check (length(trim(body)) between 2 and 1000),
  source text not null default 'board' check (source in ('board', 'vote_reason')),
  created_at timestamptz not null default now()
);
create index if not exists posts_week_idx on public.posts (week_end, created_at desc);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  week_end date not null,
  voter_name text not null check (voter_name in ('Jacob', 'Will', 'Brandon', 'Cole', 'Tommy', 'Xan')),
  candidate_id uuid not null references public.candidates(id),
  reason_post_id uuid not null references public.posts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_end, voter_name)
);
create index if not exists votes_week_idx on public.votes (week_end);

create table if not exists public.weekly_closures (
  week_end date primary key,
  finalized_at timestamptz not null default now()
);

create table if not exists public.weekly_winners (
  id uuid primary key default gen_random_uuid(),
  week_end date not null references public.weekly_closures(week_end) on delete cascade,
  candidate_id uuid not null references public.candidates(id),
  vote_count integer not null check (vote_count >= 1),
  reason_post_id uuid references public.posts(id) on delete set null,
  reason_title text,
  reason_body text,
  unique (week_end, candidate_id)
);

create table if not exists public.legacy_wins (
  id uuid primary key default gen_random_uuid(),
  legacy_slot integer unique,
  candidate_id uuid not null references public.candidates(id),
  week_end date,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.candidates enable row level security;
alter table public.posts enable row level security;
alter table public.votes enable row level security;
alter table public.weekly_closures enable row level security;
alter table public.weekly_winners enable row level security;
alter table public.legacy_wins enable row level security;
-- No browser-facing policies: the server uses a Supabase secret key only.

create or replace function public.rotw_week_end(at_time timestamptz)
returns date language sql stable as $$
  select date_trunc('week', at_time at time zone 'America/New_York')::date + 6;
$$;

create or replace function public.rotw_closes_at(for_week date)
returns timestamptz language sql stable as $$
  select ((for_week + 1)::timestamp at time zone 'America/New_York');
$$;

create or replace function public.create_rotw_post(
  p_author text, p_candidate_name text, p_title text, p_body text
) returns public.posts
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_candidate_id uuid;
  result public.posts;
  current_week date;
begin
  if p_author not in ('Jacob','Will','Brandon','Cole','Tommy','Xan') then
    raise exception 'Choose one of the six roommates as the author.';
  end if;
  if length(trim(coalesce(p_candidate_name,''))) not between 2 and 40
     or length(trim(coalesce(p_title,''))) not between 2 and 100
     or length(trim(coalesce(p_body,''))) not between 2 and 1000 then
    raise exception 'Enter a name, a title, and a description within the displayed limits.';
  end if;
  current_week := public.rotw_week_end(clock_timestamp());
  insert into public.candidates(name)
  values (trim(p_candidate_name))
  on conflict (name_key) do update set name = candidates.name
  returning id into target_candidate_id;
  insert into public.posts(week_end,candidate_id,author_name,title,body)
  values (current_week,target_candidate_id,p_author,trim(p_title),trim(p_body))
  returning * into result;
  return result;
end;
$$;

create or replace function public.submit_rotw_vote(
  p_voter text, p_candidate_name text, p_reason_post_id uuid default null, p_reason_text text default null
) returns public.votes
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_candidate_id uuid;
  selected_post uuid;
  current_week date;
  result public.votes;
begin
  if p_voter not in ('Jacob','Will','Brandon','Cole','Tommy','Xan') then
    raise exception 'Choose your roommate name before voting.';
  end if;
  if length(trim(coalesce(p_candidate_name,''))) not between 2 and 40 then
    raise exception 'Choose or enter a candidate name.';
  end if;
  current_week := public.rotw_week_end(clock_timestamp());
  perform pg_advisory_xact_lock(hashtext('rotw:' || current_week::text));
  if extract(dow from clock_timestamp() at time zone 'America/New_York') <> 0
     or clock_timestamp() >= public.rotw_closes_at(current_week)
     or exists (select 1 from public.weekly_closures where week_end=current_week) then
    raise exception 'Voting is open only on Sunday before midnight Eastern.';
  end if;
  insert into public.candidates(name)
  values (trim(p_candidate_name))
  on conflict (name_key) do update set name = candidates.name
  returning id into target_candidate_id;
  if p_reason_post_id is not null then
    select id into selected_post from public.posts
    where id=p_reason_post_id and week_end=current_week and candidate_id=target_candidate_id;
    if selected_post is null then
      raise exception 'Choose a reason posted this week for that candidate.';
    end if;
  elsif length(trim(coalesce(p_reason_text,''))) between 2 and 1000 then
    insert into public.posts(week_end,candidate_id,author_name,title,body,source)
    values (current_week,target_candidate_id,p_voter,'A reason to vote for ' || trim(p_candidate_name),trim(p_reason_text),'vote_reason')
    returning id into selected_post;
  else
    raise exception 'Choose a post or write a reason for your vote.';
  end if;
  insert into public.votes(week_end,voter_name,candidate_id,reason_post_id)
  values (current_week,p_voter,target_candidate_id,selected_post)
  on conflict (week_end,voter_name) do update
    set candidate_id=excluded.candidate_id,
        reason_post_id=excluded.reason_post_id,
        updated_at=now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.finalize_rotw_week(p_week_end date)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext('rotw:' || p_week_end::text));
  if clock_timestamp() < public.rotw_closes_at(p_week_end) then
    raise exception 'This week has not closed yet.';
  end if;
  if exists (select 1 from public.weekly_closures where week_end=p_week_end) then
    return;
  end if;
  insert into public.weekly_closures(week_end) values (p_week_end);
  insert into public.weekly_winners(week_end,candidate_id,vote_count,reason_post_id,reason_title,reason_body)
  with counts as (
    select candidate_id, count(*)::integer as vote_count
    from public.votes where week_end=p_week_end group by candidate_id
  ), leaders as (
    select * from counts where vote_count = (select max(vote_count) from counts)
  )
  select p_week_end,l.candidate_id,l.vote_count,reason.id,reason.title,reason.body
  from leaders l
  left join lateral (
    select p.id,p.title,p.body from public.votes v
    join public.posts p on p.id=v.reason_post_id
    where v.week_end=p_week_end and v.candidate_id=l.candidate_id
    group by p.id,p.title,p.body,p.created_at
    order by count(*) desc,p.created_at asc
    limit 1
  ) reason on true;
end;
$$;

create or replace function public.finalize_rotw_due()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item record;
  closed_count integer := 0;
begin
  for item in
    select distinct v.week_end from public.votes v
    where public.rotw_closes_at(v.week_end) <= clock_timestamp()
      and not exists (select 1 from public.weekly_closures c where c.week_end=v.week_end)
    order by v.week_end
  loop
    perform public.finalize_rotw_week(item.week_end);
    closed_count := closed_count + 1;
  end loop;
  return closed_count;
end;
$$;

revoke all on function public.create_rotw_post(text,text,text,text) from public, anon, authenticated;
revoke all on function public.submit_rotw_vote(text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.finalize_rotw_week(date) from public, anon, authenticated;
revoke all on function public.finalize_rotw_due() from public, anon, authenticated;
grant execute on function public.create_rotw_post(text,text,text,text) to service_role;
grant execute on function public.submit_rotw_vote(text,text,uuid,text) to service_role;
grant execute on function public.finalize_rotw_week(date) to service_role;
grant execute on function public.finalize_rotw_due() to service_role;

insert into public.candidates(name,is_roommate) values
('Jacob',true),('Will',true),('Brandon',true),('Cole',true),('Tommy',true),('Xan',true)
on conflict (name_key) do update set is_roommate=true;

insert into public.candidates(name) values ('Sarah') on conflict (name_key) do nothing;

-- Twenty earlier wins. The three remembered dates are Sundays; other dates and reasons are unknown.
insert into public.legacy_wins(legacy_slot,candidate_id,week_end)
select n.slot,c.id,n.week_end
from (values
  (1,'Will',null::date),(2,'Will',null::date),(3,'Will',null::date),
  (4,'Will',null::date),(5,'Will',null::date),(6,'Will',null::date),
  (7,'Will',null::date),(8,'Will',null::date),(9,'Will',null::date),
  (10,'Will',null::date),(11,'Will',null::date),(12,'Will',date '2026-09-20'),
  (13,'Tommy',null::date),(14,'Tommy',null::date),(15,'Tommy',null::date),
  (16,'Tommy',null::date),(17,'Tommy',null::date),
  (18,'Sarah',null::date),(19,'Xan',date '2026-09-13'),
  (20,'Brandon',date '2026-09-27')
) as n(slot,name,week_end)
join public.candidates c on c.name_key=lower(n.name)
on conflict (legacy_slot) do nothing;
