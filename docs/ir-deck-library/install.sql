-- Account-owned IR deck library. No AI or n8n calls; existing files are not deleted.
begin;
create table if not exists ir_deck_private.library_entries_v1 (
 deck_id uuid primary key references public.ir_decks(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 title text check(title is null or char_length(btrim(title)) between 1 and 200),
 hidden_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table ir_deck_private.library_entries_v1 enable row level security;
revoke all on ir_deck_private.library_entries_v1 from public,anon,authenticated;
grant select,insert,update on ir_deck_private.library_entries_v1 to service_role;
create index if not exists ir_library_owner_v1 on ir_deck_private.library_entries_v1(user_id,deck_id);

create or replace function public.list_my_ir_decks_v1(
 p_limit integer default 50,p_before_created timestamptz default null,p_before_id uuid default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();items jsonb;last_item jsonb;more boolean;
begin
 if u is null then raise exception '로그인 후 이용해주세요.' using errcode='28000'; end if;
 if p_limit is null or p_limit not between 1 and 100 or (p_before_created is null)<>(p_before_id is null) then
  raise exception '목록 조회 범위를 확인해주세요.' using errcode='22023'; end if;
 with rows as (
  select d.id,d.created_at,
   jsonb_build_object('deck_id',d.id,
    'title',coalesce(l.title,nullif(nullif(d.slides->0->'content'->>'title','사업/서비스명'),'사업명'),nullif(d.title,''),'새 IR 덱'),
    'created_at',d.created_at,'updated_at',greatest(d.created_at,l.updated_at,s.updated_at,a.updated_at,h.updated_at),
    'analysis_job_id',a.id,'analysis_status',a.status,'html_job_id',h.id,'html_state',h.state,
    'document_id',case when h.state='ready' then doc.id else null end) as item
  from public.ir_decks d
  left join ir_deck_private.library_entries_v1 l on l.deck_id=d.id and l.user_id=u
  left join lateral(select s.updated_at from ir_deck_private.sources s where s.deck_id=d.id and s.user_id=u order by s.created_at desc,s.id desc limit 1) s on true
  left join lateral(select a.id,a.status,a.updated_at from ir_deck_private.jobs a where a.deck_id=d.id and a.user_id=u and a.job_kind='analyze' order by a.created_at desc,a.id desc limit 1) a on true
  left join lateral(select h.id,h.state,h.updated_at from ir_deck_private.html_jobs_v1 h where h.deck_id=d.id and h.user_id=u order by h.created_at desc,h.id desc limit 1) h on true
  left join ir_deck_private.html_documents_v1 doc on doc.job_id=h.id and doc.user_id=u
  where d.user_id=u and l.hidden_at is null
   and (s.updated_at is not null or h.id is not null)
   and (p_before_created is null or (d.created_at,d.id)<(p_before_created,p_before_id))
  order by d.created_at desc,d.id desc limit p_limit+1
 ), page as(select item,created_at,id,row_number() over(order by created_at desc,id desc) n from rows)
 select coalesce(jsonb_agg(item order by created_at desc,id desc) filter(where n<=p_limit),'[]'::jsonb),count(*)>p_limit
  into items,more from page;
 last_item:=items->(jsonb_array_length(items)-1);
 return jsonb_build_object('owner_id',u,'items',items,'next_cursor',case when more then
  jsonb_build_object('created_at',last_item->'created_at','deck_id',last_item->'deck_id') else null end);
end $$;

create or replace function public.get_my_ir_deck_resume_v1(p_deck_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();d public.ir_decks%rowtype;s ir_deck_private.sources%rowtype;
 a ir_deck_private.jobs%rowtype;h ir_deck_private.html_jobs_v1%rowtype;
 l ir_deck_private.library_entries_v1%rowtype;b ir_deck_private.brand_settings_v3%rowtype;
 doc_id uuid;business jsonb;preview_titles jsonb;
begin
 if u is null then raise exception '로그인 후 이용해주세요.' using errcode='28000'; end if;
 select * into d from public.ir_decks where id=p_deck_id and user_id=u;
 if not found then raise exception '덱을 찾을 수 없습니다.' using errcode='42501'; end if;
 select * into l from ir_deck_private.library_entries_v1 where deck_id=d.id and user_id=u;
 if l.hidden_at is not null then raise exception '목록에서 삭제된 덱입니다.' using errcode='22023'; end if;
 select * into a from ir_deck_private.jobs where deck_id=d.id and user_id=u and job_kind='analyze' order by created_at desc,id desc limit 1;
 select * into s from ir_deck_private.sources where deck_id=d.id and user_id=u
  order by (id=a.source_id) desc nulls last,created_at desc,id desc limit 1;
 if s.id is null then raise exception '서버에 저장된 사업계획서를 찾을 수 없습니다.' using errcode='22023'; end if;
 select * into h from ir_deck_private.html_jobs_v1 where deck_id=d.id and user_id=u order by created_at desc,id desc limit 1;
 if h.state='ready' then select id into doc_id from ir_deck_private.html_documents_v1 where job_id=h.id and user_id=u; end if;
 select * into b from ir_deck_private.brand_settings_v3 where deck_id=d.id and user_id=u;
 if a.status='completed' then business:=public.get_ir_business_review_v2(d.id); end if;
 select coalesce(jsonb_agg(entry->'content'->>'title' order by ord),'[]'::jsonb) into preview_titles
  from jsonb_array_elements(case when jsonb_typeof(d.slides)='array' then d.slides else '[]'::jsonb end) with ordinality v(entry,ord);
 return jsonb_build_object('owner_id',u,'deck_id',d.id,'title',coalesce(l.title,d.title,'IR 덱'),
  'source',jsonb_build_object('source_id',s.id,'input_kind',s.input_kind,'state',s.state,
   'filename',s.original_filename,'size_bytes',s.expected_bytes,'file_sha256',s.file_sha256,
   'source_text',case when s.input_kind='text' then s.source_text else null end),
  'analysis',case when a.id is not null then jsonb_build_object('job_id',a.id,'client_request_id',a.client_request_id,
   'status',a.status,'source_id',a.source_id) else null end,
  'business',business,'preview_titles',preview_titles,
  'brand',b.settings,
  'html',case when h.id is not null then jsonb_build_object('job_id',h.id,'client_request_id',h.client_request_id,
   'source_id',h.source_id,'state',h.state,'business_revision',h.business_revision,'brand_revision',h.brand_revision,
   'brand',h.brand_snapshot,'document_id',doc_id) else null end);
end $$;

create or replace function public.rename_my_ir_deck_v1(p_deck_id uuid,p_title text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();v_title text:=btrim(p_title);
begin
 if u is null then raise exception '로그인 후 이용해주세요.' using errcode='28000'; end if;
 if v_title is null or char_length(v_title) not between 1 and 200 or v_title~E'[\\r\\n]' then
  raise exception '덱 제목은 줄바꿈 없이 200자 이하로 입력해주세요.' using errcode='22023'; end if;
 perform 1 from public.ir_decks where id=p_deck_id and user_id=u for update;
 if not found then raise exception '덱을 찾을 수 없습니다.' using errcode='42501'; end if;
 if exists(select 1 from ir_deck_private.library_entries_v1 where deck_id=p_deck_id and hidden_at is not null) then
  raise exception '목록에서 삭제된 덱입니다.' using errcode='22023'; end if;
 insert into ir_deck_private.library_entries_v1(deck_id,user_id,title) values(p_deck_id,u,v_title)
 on conflict(deck_id) do update set title=excluded.title,updated_at=now();
 update public.ir_decks set title=v_title where id=p_deck_id and user_id=u;
 return jsonb_build_object('saved',true,'owner_id',u,'deck_id',p_deck_id,'title',v_title);
end $$;

create or replace function public.hide_my_ir_deck_v1(p_deck_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception '로그인 후 이용해주세요.' using errcode='28000'; end if;
 perform 1 from public.ir_decks where id=p_deck_id and user_id=u for update;
 if not found then raise exception '덱을 찾을 수 없습니다.' using errcode='42501'; end if;
 insert into ir_deck_private.library_entries_v1(deck_id,user_id,hidden_at) values(p_deck_id,u,now())
 on conflict(deck_id) do update set hidden_at=coalesce(ir_deck_private.library_entries_v1.hidden_at,excluded.hidden_at),updated_at=now();
 return jsonb_build_object('hidden',true,'owner_id',u,'deck_id',p_deck_id);
end $$;

revoke all on function public.list_my_ir_decks_v1(integer,timestamptz,uuid) from public,anon;
revoke all on function public.get_my_ir_deck_resume_v1(uuid) from public,anon;
revoke all on function public.rename_my_ir_deck_v1(uuid,text) from public,anon;
revoke all on function public.hide_my_ir_deck_v1(uuid) from public,anon;
grant execute on function public.list_my_ir_decks_v1(integer,timestamptz,uuid) to authenticated;
grant execute on function public.get_my_ir_deck_resume_v1(uuid) to authenticated;
grant execute on function public.rename_my_ir_deck_v1(uuid,text) to authenticated;
grant execute on function public.hide_my_ir_deck_v1(uuid) to authenticated;
commit;
select jsonb_build_object('step','ir_deck_account_library_v1','status','ready','owner_filter','auth.uid()',
 'list_html_payload_included',false,'existing_files_deleted',false,'ai_called',false,'n8n_called',false) as result;
