begin;

create or replace function public.get_my_saved_notice_detail_v1(p_notice_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  n public.notices%rowtype;
  stored_report jsonb;
  review_id uuid;
begin
  if me is null then raise exception using errcode='42501', message='LOGIN_REQUIRED'; end if;
  select candidate.* into n
  from public.saved_notices s
  join public.notices candidate on candidate.id=s.notice_id
  where s.user_id=me and s.notice_id=p_notice_id
    and matching_private.notice_customer_visible_v4(candidate);
  if not found then return null; end if;

  select a.condition_analysis->'report' into stored_report
  from public.notice_analysis a where a.notice_id=n.id;

  -- Legacy evaluations identify their source by URL. A shared application portal
  -- cannot identify a single notice, so only use an unambiguous application URL.
  select j.id into review_id
  from plan_review_private.jobs_v1 j
  join plan_review_private.results_v1 r on r.job_id=j.id and r.user_id=me
  where j.user_id=me and j.status='completed' and r.notice_fit_status='completed'
    and j.notice_url in (n.url,n.application_url)
    and not exists (
      select 1 from public.notices other
      where other.id<>n.id and j.notice_url in (other.url,other.application_url)
    )
  order by j.completed_at desc nulls last,j.created_at desc,j.id desc limit 1;

  return jsonb_build_object(
    'report',case when jsonb_typeof(stored_report)='object' and stored_report<>'{}'::jsonb
      then jsonb_build_object('status','ready','notice',jsonb_build_object(
        'title',n.title,'url',n.url,'application_url',n.application_url),
        'report',stored_report) end,
    'review',case when review_id is not null then public.get_my_plan_review_v1(review_id) end);
end;
$$;
revoke all on function public.get_my_saved_notice_detail_v1(uuid) from public,anon,service_role;
grant execute on function public.get_my_saved_notice_detail_v1(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
