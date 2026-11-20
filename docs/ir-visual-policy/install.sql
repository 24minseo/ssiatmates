-- 화면 검사 완료 문서를 ready로 전환합니다. 한 번 보정한 뒤의 잔여 화면 품질 문제는 내부 기록으로 보존합니다.
begin;
create or replace function public.finish_ir_html_job_v1(
 p_job_id uuid,p_claim_token uuid,p_document_id uuid,p_document_md5 text,p_image_revision integer,
 p_renderer_version text,p_render_report jsonb,p_render_elapsed_ms integer
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j ir_deck_private.html_jobs_v1%rowtype;d ir_deck_private.html_documents_v1%rowtype;
 fingerprint text;slide jsonb;expected jsonb;i integer:=0;field text;metric_value numeric;
 visual_policy boolean;quality_issue jsonb;quality_count integer:=0;
 unchecked_count numeric:=0;extra_warnings jsonb:='[]'::jsonb;final_validation jsonb;
begin
 if p_job_id is null or p_claim_token is null or p_document_id is null
  or p_document_md5 is null or p_document_md5!~'^[a-f0-9]{32}$'
  or p_image_revision is null or p_image_revision<0
  or p_renderer_version is distinct from 'ir_html_browser_v1'
  or p_render_elapsed_ms is null or p_render_elapsed_ms not between 0 and 300000 then
  raise exception '화면 검사 완료 요청값을 확인해주세요.' using errcode='22023'; end if;
 if jsonb_typeof(p_render_report) is distinct from 'object' or octet_length(p_render_report::text)>65536
  or p_render_report->'passed' is distinct from 'true'::jsonb
  or p_render_report->'fonts_loaded' is distinct from 'true'::jsonb
  or p_render_report->'slide_count' is distinct from '7'::jsonb
  or p_render_report->>'contrast_scope' is distinct from 'solid_background_html_text_only'
  or p_render_report->'semantic_accuracy_verified' is distinct from 'false'::jsonb
  or jsonb_typeof(p_render_report->'slides') is distinct from 'array' then
  raise exception '정상적인 7장 화면 검사 결과가 필요합니다.' using errcode='22023'; end if;
 if jsonb_array_length(p_render_report->'slides')<>7 then
  raise exception '화면 검사 결과는 7장이어야 합니다.' using errcode='22023'; end if;
 fingerprint:=md5(jsonb_build_object('claim',p_claim_token,'document',p_document_id,'md5',p_document_md5,
  'imageRevision',p_image_revision,'renderer',p_renderer_version,'report',p_render_report,
  'elapsedMs',p_render_elapsed_ms)::text);
 select * into j from ir_deck_private.html_jobs_v1 where id=p_job_id for update;
 if not found then raise exception 'HTML 생성 작업을 찾을 수 없습니다.' using errcode='22023'; end if;
 select * into d from ir_deck_private.html_documents_v1 where id=p_document_id and job_id=j.id
  and deck_id=j.deck_id and user_id=j.user_id for update;
 if not found then raise exception '작업에 해당하는 HTML 문서를 찾을 수 없습니다.' using errcode='22023'; end if;

 visual_policy:=coalesce(p_render_report->>'visual_policy','')='after_one_repair_v1';
 if p_render_report ? 'visual_policy' and not visual_policy then
  raise exception '알 수 없는 화면 표시 정책입니다.' using errcode='22023'; end if;
 if visual_policy then
  if not exists(select 1 from ir_deck_private.html_slide_repairs_v2 r
    where r.job_id=j.id and r.document_id=d.id and r.state='applied' and r.applied_at is not null
     and (r.applied_md5=d.document_md5 or r.applied_md5=d.validation->>'contrast_source_md5')) then
   raise exception '부분 보정이 저장된 문서에만 잔여 화면 문제를 허용합니다.' using errcode='22023'; end if;
  if p_render_report->'visual_passed' is distinct from 'false'::jsonb then
   raise exception '원래 화면 검사 결과를 보존해주세요.' using errcode='22023'; end if;
 end if;
 -- 응답 유실 뒤 같은 요청을 재전송해도 생성이나 완료 기록을 반복하지 않습니다.
 if j.state='ready' then
  if d.validation->>'completion_fingerprint' is distinct from fingerprint then
   raise exception '이미 완료된 작업의 저장 요청과 다릅니다.' using errcode='22023'; end if;
  return jsonb_build_object('saved',true,'reused',true,'ready',true,'job_id',j.id,'document_id',d.id,
   'document_md5',d.document_md5,'image_revision',d.image_revision,'state','ready');
 end if;
 if j.state<>'validating' or j.claim_token is distinct from p_claim_token
  or j.lease_expires_at is null or j.lease_expires_at<=now() then
  raise exception '사용 가능한 HTML 완료 저장 작업이 아닙니다.' using errcode='22023'; end if;
 if d.document_md5<>p_document_md5 or d.image_revision<>p_image_revision
  or d.validation->>'validator_version' is distinct from 'ir_html_static_v1'
  or d.validation->'security_checked' is distinct from 'true'::jsonb then
  raise exception '검사한 HTML·이미지 버전과 저장 문서가 다릅니다.' using errcode='40001'; end if;
 for slide in select entry.item from jsonb_array_elements(p_render_report->'slides') as entry(item) loop
  expected:=d.document->'slides'->i;i:=i+1;
  if jsonb_typeof(slide) is distinct from 'object'
   or slide->>'slideId' is distinct from expected->>'slideId'
   or slide->'passed' is distinct from 'true'::jsonb
   or jsonb_typeof(slide->'issues') is distinct from 'array' then
   raise exception '%번째 장의 화면 검사 결과가 맞지 않습니다.',i using errcode='22023'; end if;
  if jsonb_array_length(slide->'issues')<>0 then
   raise exception '%번째 장에 미해결 화면 검사 문제가 있습니다.',i using errcode='22023'; end if;

  if visual_policy then
   if jsonb_typeof(slide->'quality_issues') is distinct from 'array'
    or jsonb_typeof(slide->'visual_passed') is distinct from 'boolean' then
    raise exception '잔여 화면 문제 기록이 필요합니다.' using errcode='22023'; end if;
   if jsonb_array_length(slide->'quality_issues')>30
    or slide->'visual_passed' is distinct from to_jsonb(jsonb_array_length(slide->'quality_issues')=0) then
    raise exception '원래 화면 검사와 잔여 문제 기록이 다릅니다.' using errcode='22023'; end if;
   for quality_issue in select value from jsonb_array_elements(slide->'quality_issues') loop
    if jsonb_typeof(quality_issue) is distinct from 'object' or
     coalesce(quality_issue->>'code','') not in ('ELEMENT_OUTSIDE_SLIDE','CONTENT_OVERFLOW',
      'TEXT_OUTSIDE_SLIDE','CLIPPED_TEXT','LOW_TEXT_CONTRAST','INVISIBLE_TEXT','NO_VISIBLE_TEXT','CANVAS_SIZE') then
     raise exception '화면 품질 이외의 오류는 표시 허용 대상이 아닙니다.' using errcode='22023'; end if;
    quality_count:=quality_count+1;
   end loop;
  elsif slide ? 'quality_issues' then
   if jsonb_typeof(slide->'quality_issues') is distinct from 'array' then
    raise exception '잔여 문제 기록의 형식을 확인해주세요.' using errcode='22023'; end if;
   if jsonb_array_length(slide->'quality_issues')<>0 then
    raise exception '부분 보정 없이 잔여 화면 문제를 허용할 수 없습니다.' using errcode='22023'; end if;
  end if;
  foreach field in array array['contrast_checked','contrast_unchecked','text_nodes'] loop
   if jsonb_typeof(slide->field) is distinct from 'number' then
    raise exception '화면 검사 수치의 형식을 확인해주세요.' using errcode='22023'; end if;
   metric_value:=(slide->>field)::numeric;
   if metric_value<0 or metric_value>100000 or metric_value<>trunc(metric_value) or (field='text_nodes' and metric_value=0 and not (visual_policy and slide->'quality_issues' @> '[{"code":"NO_VISIBLE_TEXT"}]'::jsonb)) then
    raise exception '화면 검사 수치의 범위를 확인해주세요.' using errcode='22023'; end if;
  end loop;
  unchecked_count:=unchecked_count+(slide->>'contrast_unchecked')::numeric;
 end loop;
 if visual_policy and (quality_count=0 or p_render_report->'quality_remaining' is distinct from to_jsonb(quality_count)) then
  raise exception '잔여 화면 문제 개수가 맞지 않습니다.' using errcode='22023'; end if;
 if unchecked_count>0 and coalesce(p_render_report->>'contrast_policy','')<>'auto_then_accept_v2' then
  extra_warnings:=jsonb_build_array(jsonb_build_object('code','PARTIAL_CONTRAST_CHECK',
   'message','SVG 또는 복합 배경의 일부 글자 대비는 자동 검사 범위에 포함되지 않았습니다.'));
 end if;
 final_validation:=d.validation||jsonb_build_object('render_checked',true,'renderer_version',p_renderer_version,
  'render_report',p_render_report,'rendered_image_revision',p_image_revision,
  'requires_render_validation',false,'completion_fingerprint',fingerprint,'render_checked_at',clock_timestamp());
 update ir_deck_private.html_documents_v1 set validation=final_validation where id=d.id;
 update ir_deck_private.html_jobs_v1 set state='ready',claim_token=null,lease_expires_at=null,
  error_code=null,error_message=null,finished_at=now(),updated_at=now(),warnings=j.warnings||extra_warnings,
  timing=j.timing||jsonb_build_object('render_elapsed_ms',p_render_elapsed_ms,
   'elapsed_ms',greatest(0,round(extract(epoch from (clock_timestamp()-j.started_at))*1000)),
   'ready_at',clock_timestamp()) where id=j.id;
 return jsonb_build_object('saved',true,'reused',false,'ready',true,'job_id',j.id,'document_id',d.id,
  'document_md5',d.document_md5,'image_revision',d.image_revision,'state','ready');
end $$;
revoke all on function public.finish_ir_html_job_v1(uuid,uuid,uuid,text,integer,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.finish_ir_html_job_v1(uuid,uuid,uuid,text,integer,text,jsonb,integer) to service_role;
commit;
select jsonb_build_object('step','ir_html_visual_after_repair_v1','status','ready','worker_access','service_role_only',
 'browser_report_required',true,'duplicate_completion_safe',true,'ai_called',false,
 'visual_quality_nonblocking_after_repair',true,'maximum_repair_passes',1,'ui_warning_enabled',false) as result;
