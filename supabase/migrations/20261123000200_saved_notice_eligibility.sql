begin;

create or replace function public.get_my_saved_notice_detail_v1(p_notice_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  n public.notices%rowtype;
  stored_report jsonb;
  plan_profile public.notice_search_profiles%rowtype;
  current_fingerprint text;
  preference_revision text;
  plan_eligibility jsonb;
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

  select * into plan_profile from public.notice_search_profiles s where s.notice_id=n.id;
  select md5(public.notice_analysis_snapshot_v2(n)::text), c.preference_revision
    into current_fingerprint, preference_revision
    from public.notice_analysis_queue_config_v2 c where c.id=true;
  plan_eligibility := jsonb_build_object(
    'business_plan_required', plan_profile.business_plan_required,
    'analysis_status', plan_profile.analysis_status,
    'is_current', coalesce(plan_profile.analysis_status='completed' and plan_profile.source_fingerprint=current_fingerprint and plan_profile.analysis_revision=preference_revision, false),
    'reason', case
      when plan_profile.notice_id is null then 'unknown'
      when plan_profile.analysis_status is distinct from 'completed' then
        case when plan_profile.analysis_status in ('queued','pending','running') then 'pending' when plan_profile.analysis_status in ('failed','error') then 'failed' else 'unknown' end
      when plan_profile.source_fingerprint is distinct from current_fingerprint or plan_profile.analysis_revision is distinct from preference_revision then 'stale'
      when plan_profile.business_plan_required is true then 'required'
      when plan_profile.business_plan_required is false then 'not_required'
      else 'unknown'
    end
  );

  return jsonb_build_object(
    'report',case when jsonb_typeof(stored_report)='object' and stored_report<>'{}'::jsonb
      then jsonb_build_object('status','ready','notice',jsonb_build_object(
        'title',n.title,'url',n.url,'application_url',n.application_url),
        'plan_review_eligibility',plan_eligibility,'report',stored_report) end
    );
end;
$$;
revoke all on function public.get_my_saved_notice_detail_v1(uuid) from public,anon,service_role;
grant execute on function public.get_my_saved_notice_detail_v1(uuid) to authenticated;
notify pgrst,'reload schema';
commit;

