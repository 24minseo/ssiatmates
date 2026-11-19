create or replace function public.get_my_notice_report_v1(p_notice_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to ''
set "TimeZone" to 'UTC'
as $function$
declare
  answer jsonb;
  n public.notices%rowtype;
  summary jsonb;
  analysis_state text;
  matching_state text;
  plan_profile public.notice_search_profiles%rowtype;
  current_fingerprint text;
  preference_revision text;
  plan_eligibility jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='로그인이 필요합니다.'; end if;
  if exists(select 1 from public.notices gate where gate.id=p_notice_id and not matching_private.notice_customer_visible_v4(gate)) then
    return jsonb_build_object('status','not_found');
  end if;
  if exists(select 1 from public.user_notice_matches m join public.notices nr on nr.id=m.notice_id left join public.notice_analysis ar on ar.notice_id=nr.id where m.user_id=auth.uid() and m.notice_id=p_notice_id and not matching_private.closed_match_visible_v2(m,nr,ar,statement_timestamp())) then
    return jsonb_build_object('status','not_found');
  end if;
  answer:=matching_private.notice_report_before_changes_v1(p_notice_id);
  if answer is null or answer->>'status'='not_found' then return answer; end if;
  if not exists(select 1 from public.user_notice_matches m where m.user_id=auth.uid() and m.notice_id=p_notice_id and m.is_current) then
    return jsonb_build_object('status','not_found');
  end if;
  select * into n from public.notices where id=p_notice_id;
  if not found then return jsonb_build_object('status','not_found'); end if;

  select * into plan_profile from public.notice_search_profiles s where s.notice_id=p_notice_id;
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

  summary:=matching_private.notice_change_summary_v1(n);
  analysis_state:=case when summary->>'change_needs_review'='true' then 'needs_review' when answer->>'status'='report_unavailable' then 'unavailable' when answer->>'source_changed'='true' then 'outdated' else 'current' end;
  matching_state:=case when summary->>'change_needs_review'='true' then 'needs_review' when answer->>'profile_changed'='true' or answer->>'source_changed'='true' or answer->>'analysis_changed'='true' then 'outdated' else 'current' end;
  return answer||summary||matching_private.notice_report_changes_v1(n)||matching_private.notice_confirmed_changes_v4(n)||jsonb_build_object(
    'analysis_freshness',analysis_state,
    'matching_freshness',matching_state,
    'freshness_message',case analysis_state when 'needs_review' then summary->>'change_review_reason' when 'outdated' then '공고가 변경되어 기존 분석 내용이 최신이 아닐 수 있습니다.' when 'unavailable' then '레포트 분석이 아직 준비되지 않았습니다.' else case when matching_state='outdated' then '사용자 매칭 결과의 갱신이 필요합니다.' else null end end,
    'plan_review_eligibility',plan_eligibility
  );
end;
$function$;
