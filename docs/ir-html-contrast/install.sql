-- Persist browser-computed text-color corrections before ready/export. No AI calls.
begin;
create or replace function public.save_ir_html_contrast_v2(
 p_document_id uuid,p_claim_token uuid,p_expected_document_md5 text,p_document jsonb,p_audit jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare d ir_deck_private.html_documents_v1%rowtype;j ir_deck_private.html_jobs_v1%rowtype;
 entry jsonb;old_entry jsonb;i integer:=0;fingerprint text;
begin
 select * into d from ir_deck_private.html_documents_v1 where id=p_document_id;
 if not found then raise exception '대비 보정 문서가 없습니다.' using errcode='22023'; end if;
 select * into j from ir_deck_private.html_jobs_v1 where id=d.job_id for update;
 select * into d from ir_deck_private.html_documents_v1 where id=p_document_id for update;
 if p_claim_token is null or j.claim_token is distinct from p_claim_token or j.state<>'validating'
  or j.lease_expires_at is null or j.lease_expires_at<=now()
  or d.image_revision<>0 or d.validation->'render_checked'='true'::jsonb
  or d.validation->'security_checked' is distinct from 'true'::jsonb then
  raise exception '대비 보정을 저장할 수 있는 검사 단계가 아닙니다.' using errcode='22023'; end if;
 if p_expected_document_md5 is null or p_expected_document_md5!~'^[a-f0-9]{32}$'
  or jsonb_typeof(p_document) is distinct from 'object' or octet_length(p_document::text)>8388608
  or jsonb_typeof(p_document->'slides') is distinct from 'array' or jsonb_array_length(p_document->'slides')<>7
  or (p_document-'slides') is distinct from (d.document-'slides')
  or jsonb_typeof(p_audit) is distinct from 'object' or octet_length(p_audit::text)>16384 then
  raise exception '대비 보정 문서 또는 기록 형식이 맞지 않습니다.' using errcode='22023'; end if;
 fingerprint:=md5(p_document::text);
 if d.document_md5<>p_expected_document_md5 then
  if d.validation->>'contrast_source_md5'=p_expected_document_md5 and d.document=p_document then
   return jsonb_build_object('saved',true,'reused',true,'job_id',j.id,'document_id',d.id,
    'document_md5',d.document_md5,'source_document_md5',p_expected_document_md5,'image_revision',d.image_revision);
  end if;
  raise exception '대비 보정 중 문서가 변경됐습니다.' using errcode='40001';
 end if;
 for entry in select value from jsonb_array_elements(p_document->'slides') loop
  old_entry:=d.document->'slides'->i;i:=i+1;
  if (entry-'html') is distinct from (old_entry-'html')
   or jsonb_typeof(entry->'html') is distinct from 'string' or char_length(btrim(entry->>'html'))=0
   or octet_length(entry->>'html')>1048576 then
   raise exception '대비 보정은 텍스트 색상용 HTML 외의 구성·CSS·이미지 설정을 변경할 수 없습니다.' using errcode='40001'; end if;
 end loop;
 update ir_deck_private.html_documents_v1 set document=p_document,document_md5=fingerprint,
  validation=validation||jsonb_build_object('contrast_source_md5',p_expected_document_md5,
   'contrast_audit',p_audit,'contrast_policy','auto_then_accept_v2','contrast_saved_at',clock_timestamp())
 where id=d.id returning * into d;
 update ir_deck_private.html_jobs_v1 set updated_at=now(),lease_expires_at=now()+interval '10 minutes'
 where id=j.id;
 return jsonb_build_object('saved',true,'reused',false,'job_id',j.id,'document_id',d.id,
  'document_md5',d.document_md5,'source_document_md5',p_expected_document_md5,'image_revision',d.image_revision);
end $$;
revoke all on function public.save_ir_html_contrast_v2(uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_ir_html_contrast_v2(uuid,uuid,text,jsonb,jsonb) to service_role;
commit;
select jsonb_build_object('step','ir_html_contrast_v2','status','ready','ai_called',false,
 'preview_and_export_use_saved_colors',true,'contrast_ui_warning',false) as result;

-- 화면 검사 통과 문서를 최종 ready로 전환합니다. PDF/PPTX 출력 완료와는 구분됩니다.
begin;
create or replace function public.finish_ir_html_job_v1(
 p_job_id uuid,p_claim_token uuid,p_document_id uuid,p_document_md5 text,p_image_revision integer,
 p_renderer_version text,p_render_report jsonb,p_render_elapsed_ms integer
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j ir_deck_private.html_jobs_v1%rowtype;d ir_deck_private.html_documents_v1%rowtype;
 fingerprint text;slide jsonb;expected jsonb;i integer:=0;field text;metric_value numeric;
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
  foreach field in array array['contrast_checked','contrast_unchecked','text_nodes'] loop
   if jsonb_typeof(slide->field) is distinct from 'number' then
    raise exception '화면 검사 수치의 형식을 확인해주세요.' using errcode='22023'; end if;
   metric_value:=(slide->>field)::numeric;
   if metric_value<0 or metric_value>100000 or metric_value<>trunc(metric_value) or (field='text_nodes' and metric_value=0) then
    raise exception '화면 검사 수치의 범위를 확인해주세요.' using errcode='22023'; end if;
  end loop;
  unchecked_count:=unchecked_count+(slide->>'contrast_unchecked')::numeric;
 end loop;
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
select jsonb_build_object('step','ir_html_finish_contrast_policy_v2','status','ready','worker_access','service_role_only',
 'browser_report_required',true,'duplicate_completion_safe',true,'ai_called',false,
 'pptx_export_connected',false) as result;

select jsonb_build_object('step','ir_html_contrast_release_v2','status','ready','ai_called',false,'ui_warning_enabled',false) as result;
