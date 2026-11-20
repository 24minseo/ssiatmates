-- 확정된 7개 항목을 검증하고 같은 순서로 슬라이드 내용 초안을 저장한다.
-- 이 단계는 디자인 렌더링/PPTX 생성 완료가 아니다.
begin;
create or replace function public.save_ir_deck_content_v1(
  p_job_id uuid,p_claim_token uuid,p_analysis jsonb
)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  j ir_deck_private.jobs%rowtype;
  s ir_deck_private.sources%rowtype;
  d public.ir_decks%rowtype;
  v_raw text;
  v_ids text[]:=array['cover','problem','target_customer','solution','product_service','market','business_model'];
  v_titles text[]:=array['사업/서비스명','문제 인식','핵심고객','해결책','제품 및 서비스','시장분석','수익 모델'];
  v_questions text[]:=array[
    '사업·서비스 이름과 제공 가치를 한 문장으로 입력해주세요.',
    '고객이 겪는 문제와 기존 해결 방식의 한계를 입력해주세요.',
    '가장 먼저 공략할 고객과 사용자·구매자의 특성을 입력해주세요.',
    '문제를 해결하는 접근 방식과 고객이 얻는 가치를 입력해주세요.',
    '실제 기능, 사용 과정과 제품·서비스 제공 형태를 입력해주세요.',
    '목표 시장, 확인 가능한 시장 자료와 경쟁 대안을 입력해주세요.',
    '누가 무엇에 얼마를 지불하는지와 과금 방식을 입력해주세요.'
  ];
  v_section jsonb;
  v_fact jsonb;
  v_ev jsonb;
  v_ref jsonb;
  v_evidence jsonb:='{}'::jsonb;
  v_slides jsonb:='[]'::jsonb;
  v_bullets jsonb;
  v_notes text;
  v_batch_count integer;
  v_i integer;
  v_fact_count integer:=0;
  v_missing integer:=0;
begin
  select * into j from ir_deck_private.jobs where id=p_job_id and claim_token=p_claim_token
    and lease_expires_at>now() and status in ('analyzing','rendering') for update;
  if not found then return jsonb_build_object('run',false,'status','claim_expired'); end if;
  select * into s from ir_deck_private.sources
    where id=j.source_id and deck_id=j.deck_id and user_id=j.user_id;
  select * into d from public.ir_decks where id=j.deck_id and user_id=j.user_id for update;
  if not found or s.id is null or s.state<>'ready' then
    return public.fail_ir_deck_job_v1(j.id,p_claim_token,'PROCESSING_FAILED');
  end if;
  if j.status='rendering' then
    if d.analysis->'content'=p_analysis and p_analysis->>'schema_version'='ir_content_7_v1'
      and jsonb_array_length(d.slides)=7 then
      return jsonb_build_object('run',true,'status','slide_content_saved','job_id',j.id,
        'deck_id',j.deck_id,'claim_token',p_claim_token,'slide_count',jsonb_array_length(d.slides),'reused',true);
    end if;
    return jsonb_build_object('run',false,'status','content_already_saved');
  end if;
  v_raw:=case when s.input_kind='text' then s.source_text else s.extracted_text end;

  begin
    if p_analysis is null or jsonb_typeof(p_analysis)<>'object'
      or char_length(p_analysis::text)>4000000
      or p_analysis->>'schema_version' is distinct from 'ir_content_7_v1'
      or p_analysis->>'source_id' is distinct from s.id::text then
      raise exception 'invalid analysis' using errcode='22023';
    end if;
    if jsonb_typeof(p_analysis->'sections') is distinct from 'array'
      or jsonb_typeof(p_analysis->'evidence') is distinct from 'array'
      or jsonb_typeof(p_analysis->'batch_indices') is distinct from 'array' then
      raise exception 'invalid arrays' using errcode='22023';
    end if;
    if jsonb_array_length(p_analysis->'sections')<>7
      or coalesce(p_analysis->>'batch_count','') !~ '^[1-9][0-9]{0,3}$' then
      raise exception 'invalid counts' using errcode='22023';
    end if;
    v_batch_count:=(p_analysis->>'batch_count')::integer;
    if jsonb_array_length(p_analysis->'batch_indices')<>v_batch_count then
      raise exception 'missing batches' using errcode='22023';
    end if;
    for v_i in 0..v_batch_count-1 loop
      if p_analysis->'batch_indices'->v_i is distinct from to_jsonb(v_i) then
        raise exception 'invalid batch indices' using errcode='22023';
      end if;
    end loop;
    for v_ev in select value from jsonb_array_elements(p_analysis->'evidence') loop
      if jsonb_typeof(v_ev->'id') is distinct from 'string'
        or jsonb_typeof(v_ev->'text') is distinct from 'string'
        or coalesce(v_ev->>'id','') !~ '^p[0-9]{6}$'
        or v_evidence ? (v_ev->>'id')
        or char_length(coalesce(v_ev->>'text','')) not between 1 and 1200
        or strpos(v_raw,v_ev->>'text')=0 then
        raise exception 'invalid source evidence' using errcode='22023';
      end if;
      v_evidence:=v_evidence||jsonb_build_object(v_ev->>'id',v_ev->>'text');
    end loop;
    for v_i in 1..7 loop
      v_section:=p_analysis->'sections'->(v_i-1);
      if v_section->>'id' is distinct from v_ids[v_i]
        or jsonb_typeof(v_section->'facts') is distinct from 'array' then
        raise exception 'invalid section' using errcode='22023';
      end if;
      for v_fact in select value from jsonb_array_elements(v_section->'facts') loop
        v_fact_count:=v_fact_count+1;
        if v_fact_count>10000 or jsonb_typeof(v_fact->'text') is distinct from 'string'
          or char_length(btrim(coalesce(v_fact->>'text',''))) not between 1 and 240
          or jsonb_typeof(v_fact->'evidence_ids') is distinct from 'array' then
          raise exception 'invalid fact' using errcode='22023';
        end if;
        if jsonb_array_length(v_fact->'evidence_ids') not between 1 and 10000 then
          raise exception 'missing evidence' using errcode='22023';
        end if;
        for v_ref in select value from jsonb_array_elements(v_fact->'evidence_ids') loop
          if jsonb_typeof(v_ref) is distinct from 'string' or not (v_evidence ? (v_ref #>> '{}')) then
            raise exception 'unknown evidence' using errcode='22023';
          end if;
        end loop;
      end loop;
      select coalesce(jsonb_agg(f->'text' order by ord),'[]'::jsonb) into v_bullets
        from jsonb_array_elements(v_section->'facts') with ordinality as x(f,ord) where ord<=4;
      select string_agg(f->>'text',E'\n' order by ord) into v_notes
        from jsonb_array_elements(v_section->'facts') with ordinality as x(f,ord) where ord>4;
      if jsonb_array_length(v_bullets)=0 then v_missing:=v_missing+1; end if;
      v_slides:=v_slides||jsonb_build_array(jsonb_build_object(
        'id','slide_'||lpad(v_i::text,2,'0'),'section_id',v_ids[v_i],
        'template_id','placeholder.bullets.v1','design_version','placeholder_v1',
        'status',case when jsonb_array_length(v_bullets)=0 then 'needs_input' else 'draft' end,
        'content',jsonb_build_object('title',case when jsonb_typeof(v_section->'title')='string' and char_length(btrim(v_section->>'title')) between 1 and 240 and (v_section->>'title') !~ E'[\r\n]' then btrim(v_section->>'title') else v_titles[v_i] end,'bullets',v_bullets,
          'speaker_notes',coalesce(v_notes,''),'missing_information',
          case when jsonb_array_length(v_bullets)=0 then jsonb_build_array(v_questions[v_i]) else '[]'::jsonb end)
      ));
    end loop;
    if v_fact_count=0 then
      update ir_deck_private.jobs set status='failed',stage='failed',
        error_code='INPUT_CONTENT_INSUFFICIENT',
        error_message='IR 덱에 사용할 사업 내용을 추출하지 못했습니다. 사업 설명을 보완해 다시 제출해주세요.',
        retryable=false,finished_at=now(),claim_token=null,lease_expires_at=null where id=j.id;
      update public.ir_decks set status='error' where id=j.deck_id and user_id=j.user_id;
      return jsonb_build_object('run',false,'status','input_content_insufficient','job_id',j.id);
    end if;
    update public.ir_decks set analysis=jsonb_build_object(
      'schema_version','ir_analysis_v1','content',p_analysis,'fact_count',v_fact_count,
      'missing_section_count',v_missing,'needs_review',true,'design_status','placeholder'
    ),slides=v_slides,status='analyzing' where id=j.deck_id and user_id=j.user_id;
    update ir_deck_private.jobs set status='rendering',stage='slide_content_ready',
      lease_expires_at=now()+interval '15 minutes' where id=j.id;
    return jsonb_build_object('run',true,'status','slide_content_saved','job_id',j.id,
      'deck_id',j.deck_id,'claim_token',p_claim_token,'slide_count',7,
      'fact_count',v_fact_count,'missing_section_count',v_missing,'reused',false);
  exception when sqlstate '22023' then
    return public.fail_ir_deck_job_v1(j.id,p_claim_token,'AI_INVALID_RESPONSE');
  end;
end;
$$;
revoke all on function public.save_ir_deck_content_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_ir_deck_content_v1(uuid,uuid,jsonb) to service_role;
commit;
select jsonb_build_object('step','ir_review_ai_titles_v1','status','ready',
  'function','save_ir_deck_content_v1','worker_access','service_role_only',
  'slide_count',7,
  'slide_titles',jsonb_build_array('사업/서비스명','문제 인식','핵심고객','해결책','제품 및 서비스','시장분석','수익 모델'),
  'design','placeholder','pptx_generation_installed',false,'ai_called',false,'n8n_called',false) as result;
