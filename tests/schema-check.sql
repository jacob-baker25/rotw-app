-- Run against a disposable PostgreSQL database after schema.sql; rolls back all test data.
begin;

do $$
begin
  if not has_table_privilege('service_role', 'public.candidates', 'select')
     or not has_table_privilege('service_role', 'public.posts', 'insert')
     or not has_table_privilege('service_role', 'public.test_votes', 'insert')
     or not has_function_privilege('service_role', 'public.submit_rotw_vote_v2(text,text,uuid,text,boolean)', 'execute')
     or not has_function_privilege('service_role', 'public.submit_rotw_test_vote_v2(text,text,uuid,text,boolean)', 'execute')
     or has_function_privilege('anon', 'public.submit_rotw_vote_v2(text,text,uuid,text,boolean)', 'execute')
     or has_table_privilege('anon', 'public.votes', 'select') then
    raise exception 'Data API grants are incorrect';
  end if;
  if (select count(*) from public.legacy_wins) <> 20 then
    raise exception 'Expected 20 historical wins';
  end if;
  if (select count(*) from public.legacy_wins w join public.candidates c on c.id=w.candidate_id where c.name='Will') <> 12
     or (select count(*) from public.legacy_wins w join public.candidates c on c.id=w.candidate_id where c.name='Tommy') <> 5
     or (select count(*) from public.legacy_wins w join public.candidates c on c.id=w.candidate_id where c.name='Sarah') <> 1
     or (select count(*) from public.legacy_wins w join public.candidates c on c.id=w.candidate_id where c.name='Xan') <> 1
     or (select count(*) from public.legacy_wins w join public.candidates c on c.id=w.candidate_id where c.name='Brandon') <> 1 then
    raise exception 'Historical win totals do not match the supplied tally';
  end if;
  if (select count(*) from public.legacy_wins where week_end in (date '2026-09-13', date '2026-09-20', date '2026-09-27')) <> 3 then
    raise exception 'Expected three dated historical wins';
  end if;
  if public.rotw_closes_at(date '2026-10-11') <> timestamptz '2026-10-12 04:00:00+00'
     or public.rotw_closes_at(date '2026-11-08') <> timestamptz '2026-11-09 05:00:00+00' then
    raise exception 'Eastern deadline conversion failed';
  end if;
end;
$$;

do $$
declare
  own_post public.posts;
begin
  own_post := public.create_rotw_post('Jacob', 'Will', 'Own post', 'A reason already on the board');
  perform public.submit_rotw_test_vote_v2('Jacob', 'Will', own_post.id, null, true);
  if not (select is_anonymous from public.posts where id=own_post.id) then
    raise exception 'Selecting your own post for an anonymous ballot must hide its author';
  end if;
end;
$$;

select public.submit_rotw_test_vote('Jacob', 'Will', null, 'Test reason');
do $$
begin
  if (select count(*) from public.test_votes) <> 1
     or (select count(*) from public.votes) <> 0 then
    raise exception 'Test ballot must stay separate from real votes';
  end if;
end;
$$;

select public.submit_rotw_test_vote_v2('Jacob', 'Will', null, 'Anonymous test reason', true);
do $$
begin
  if not (select is_anonymous from public.test_votes where voter_name='Jacob')
     or not exists (
       select 1 from public.posts p
       join public.test_votes v on v.reason_post_id=p.id
       where v.voter_name='Jacob' and p.is_anonymous and p.source='vote_reason'
         and p.body='Anonymous test reason'
     ) then
    raise exception 'Anonymous test reason should become an anonymous post';
  end if;
end;
$$;

insert into public.posts(week_end,candidate_id,author_name,title,body)
select date '2026-09-06',id,'Jacob','Will reason','A good thing Will did'
from public.candidates where name='Will';
insert into public.posts(week_end,candidate_id,author_name,title,body)
select date '2026-09-06',id,'Jacob','Tommy reason','A good thing Tommy did'
from public.candidates where name='Tommy';

insert into public.votes(week_end,voter_name,candidate_id,reason_post_id)
select date '2026-09-06',v.voter,c.id,p.id
from (values ('Jacob'),('Brandon')) v(voter)
join public.candidates c on c.name='Will'
join public.posts p on p.title='Will reason';
insert into public.votes(week_end,voter_name,candidate_id,reason_post_id)
select date '2026-09-06',v.voter,c.id,p.id
from (values ('Cole'),('Xan')) v(voter)
join public.candidates c on c.name='Tommy'
join public.posts p on p.title='Tommy reason';

select public.finalize_rotw_week(date '2026-09-06');
do $$
begin
  if (select count(*) from public.weekly_winners where week_end=date '2026-09-06') <> 2 then
    raise exception 'A tied week should save two winners';
  end if;
  if exists (select 1 from public.weekly_winners where week_end=date '2026-09-06' and (vote_count<>2 or reason_body is null)) then
    raise exception 'Winner count or reason snapshot incorrect';
  end if;
end;
$$;

rollback;
