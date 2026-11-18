-- Reuse the owner's existing successful URL-only analysis. No shared/private data copying.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
create or replace function manual_notice_private.url_cache_key_v1(p_url text)
returns text language plpgsql immutable set search_path='' as $$
declare u text; m text[]; part text; k text; v text; found_id text;
begin
  if p_url is null or length(p_url)>8192 then return null; end if;
  u:=split_part(btrim(p_url),'#',1);
  m:=regexp_match(u,'^https?://(www\.)?(k-startup\.go\.kr|bizinfo\.go\.kr)(/[^?#[:space:]]*)[?]([^#[:space:]]*)$','i');
  if m is null then return null; end if;
  if lower(m[2])='k-startup.go.kr' then
    if lower(m[3]) not in ('/web/contents/bizpbanc-ongoing.do','/web/contents/bizpbanc-deadline.do') then return null; end if;
    k:='pbancsn';
  else
    if lower(m[3])<>'/sii/siia/selectsiia200detail.do' then return null; end if;
    k:='pblancid';
  end if;
  foreach part in array string_to_array(replace(m[4],'&amp;','&'),'&') loop
    if lower(split_part(part,'=',1))<>k then continue; end if;
    v:=substring(part from position('=' in part)+1);
    if k='pbancsn' and v !~ '^[0-9]+$' then return null; end if;
    if k='pblancid' and upper(v) !~ '^PBLN_[0-9]+$' then return null; end if;
    v:=upper(v);
    if found_id is not null and found_id<>v then return null; end if;
    found_id:=v;
  end loop;
  if found_id is null then return null; end if;
  return lower(m[2])||':'||found_id;
end;
$$;
revoke all on function manual_notice_private.url_cache_key_v1(text) from public,anon,authenticated;
create index if not exists manual_notice_url_cache_idx
 on manual_notice_private.manual_notices_v1(owner_user_id,manual_notice_private.url_cache_key_v1(input_url),updated_at desc)
 where state in ('ready','confirmed');

create or replace function public.get_my_manual_notice_url_cache_v1(p_url text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid(); cache_key text; n manual_notice_private.manual_notices_v1%rowtype;
begin
  if me is null then raise exception using errcode='42501',message='로그인이 필요합니다.'; end if;
  cache_key:=manual_notice_private.url_cache_key_v1(p_url);
  if cache_key is null then return jsonb_build_object('cache_hit',false); end if;
  select * into n from manual_notice_private.manual_notices_v1 x
   where x.owner_user_id=me and x.state in ('ready','confirmed')
    and manual_notice_private.url_cache_key_v1(x.input_url)=cache_key
    and x.analysis_validation->>'status'='checks_passed'
    and x.analyzed_at is not null and length(btrim(x.source_text))>0
    and length(btrim(x.notice_preview->>'title'))>0
    and jsonb_typeof(x.report->'matching_conditions')='object'
    and jsonb_typeof(x.report->'sections')='object'
    -- A file-assisted analysis may contain extra facts that the URL alone does not provide.
    and jsonb_typeof(x.source_documents)='array'
    and exists(select 1 from jsonb_array_elements(x.source_documents) d where d->>'field'='link_text')
    and not exists(select 1 from jsonb_array_elements(x.source_documents) d where d->>'field'='file_text')
   order by x.updated_at desc,x.id limit 1;
  if n.id is null then return jsonb_build_object('cache_hit',false); end if;
  return jsonb_build_object('success',true,'cache_hit',true,'reused',true,'status',n.state,
    'manual_notice_id',n.id,'request_id',n.request_id,
    'notice',n.notice_preview||jsonb_build_object('support_type',n.notice_preview->'field'),
    'report',n.report,'is_confirmed',n.state='confirmed','analyzed_at',n.analyzed_at);
end;
$$;
revoke all on function public.get_my_manual_notice_url_cache_v1(text) from public,anon,service_role;
grant execute on function public.get_my_manual_notice_url_cache_v1(text) to authenticated;
notify pgrst,'reload schema';
select jsonb_build_object('status','ready','step','manual_notice_url_cache_v1','ai_called',false) as result;
commit;
