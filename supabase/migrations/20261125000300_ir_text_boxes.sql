begin;
create or replace function public.save_ir_html_text_v1(
  p_document_id uuid, p_slide_id text, p_text_id text, p_revision integer, p_edit jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  d ir_deck_private.html_documents_v1%rowtype;
  slide_index integer;
  path text[];
  edits jsonb;
  next_doc jsonb;
begin
  select doc.* into d from ir_deck_private.html_documents_v1 doc
  join public.ir_decks deck on deck.id=doc.deck_id and deck.user_id=auth.uid()
  join ir_deck_private.html_jobs_v1 job on job.id=doc.job_id and job.state='ready'
  where doc.id=p_document_id and doc.user_id=auth.uid() for update of doc;
  if not found then raise exception '문서에 접근할 수 없습니다.'; end if;
  if p_text_id is null or p_text_id !~ '^(t[0-9]{1,5}|u[0-9a-f]{32})$' or jsonb_typeof(p_edit) is distinct from 'object'
     or p_edit - array['text','size','bold','x','y','colors','align','designFont','deleted'] <> '{}'::jsonb
     or (p_edit ? 'align' and coalesce(p_edit->>'align','') not in ('left','center','right'))
     or (p_edit ? 'designFont' and (left(p_text_id,1)<>'u' or coalesce(p_edit->>'designFont','') not in ('Paperlogy','Pretendard')))
     or (p_edit ? 'deleted' and p_edit <> '{"deleted":true}'::jsonb)
     or (left(p_text_id,1)='u' and not (p_edit ? 'deleted' or (p_edit ? 'text' and p_edit ? 'designFont')))
     or (p_edit ? 'text' and (jsonb_typeof(p_edit->'text') <> 'string' or length(p_edit->>'text') > 6000 or p_edit->>'text' !~ '[^[:space:]]'))
     or (p_edit ? 'bold' and jsonb_typeof(p_edit->'bold') <> 'boolean') then
    raise exception '텍스트 편집값을 확인해 주세요.';
  end if;
  if exists(select 1 from jsonb_each(p_edit) kv where key in ('size','x','y')
    and case when jsonb_typeof(value)<>'number' then true
      when key='size' then (value::text)::numeric not between 1 and 512
      else abs((value::text)::numeric)>1920 end) then raise exception '크기와 위치를 확인해 주세요.'; end if;
  if p_edit ? 'colors' then
    if jsonb_typeof(p_edit->'colors') <> 'array' or jsonb_typeof(p_edit->'text') is distinct from 'string' then
      raise exception '색상 범위를 확인해 주세요.';
    end if;
    if jsonb_array_length(p_edit->'colors') > 6000 or exists (
      select 1 from jsonb_array_elements(p_edit->'colors') with ordinality a(r,n)
      where jsonb_typeof(r) <> 'object' or coalesce(r->>'color','') !~ '^#[0-9A-Fa-f]{6}$'
        or case when jsonb_typeof(r->'start') is distinct from 'number' or jsonb_typeof(r->'end') is distinct from 'number'
          or r->>'start' !~ '^[0-9]{1,5}$' or r->>'end' !~ '^[0-9]{1,5}$' then true
          else (r->>'start')::integer < 0 or (r->>'end')::integer <= (r->>'start')::integer
            or (r->>'end')::integer > 12000 end
    ) then raise exception '색상 범위를 확인해 주세요.'; end if;
  end if;
  select ord::integer-1 into slide_index from jsonb_array_elements(d.document->'slides') with ordinality a(s,ord)
  where s->>'slideId'=p_slide_id;
  if slide_index is null then raise exception '슬라이드를 확인해 주세요.'; end if;
  path:=array['slides',slide_index::text,'textEdits'];
  edits:=coalesce(d.document #> path,'{}'::jsonb);
  if coalesce(edits->p_text_id,'{}'::jsonb) is distinct from p_edit then
    if d.image_revision is distinct from p_revision then raise exception '다른 편집이 저장됐어요. 최신 화면에서 다시 수정해 주세요.'; end if;
    next_doc:=jsonb_set(d.document,path,case when left(p_text_id,1)='u' and p_edit ? 'deleted' then edits-p_text_id else edits||jsonb_build_object(p_text_id,p_edit) end);
    update ir_deck_private.html_documents_v1 set document=next_doc,document_md5=md5(next_doc::text),
      image_revision=image_revision+1 where id=d.id;
  end if;
  return public.get_ir_html_document_v1(d.id);
end $$;
revoke all on function public.save_ir_html_text_v1(uuid,text,text,integer,jsonb) from public, anon;
grant execute on function public.save_ir_html_text_v1(uuid,text,text,integer,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
