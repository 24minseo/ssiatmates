// n8n Code: Run Once for All Items. No AI/network calls.
const request = $('HTML 구성 요청 준비').first().json;
const claim = $('HTML 작업 예약').first().json;
const catalog = $('HTML 레이아웃 목록 조회').first().json;
const responses = $input.all();
const response = responses[0]?.json;
const base = { job_id: request.job_id, claim_token: request.claim_token };
const fail = (code, message, detail) => [{json:{...base,valid:false,error_code:code,
  message,diagnostic:detail,usage:response?.usage ?? null}}];
if (responses.length !== 1 || !response || response.error) {
  const status = Number(response?.statusCode ?? response?.error?.statusCode ?? 0);
  const errorText = JSON.stringify(response?.error ?? '').toLowerCase();
  const timeout = status === 408 || status === 504 || /timeout|timed out|etimedout|esockettimedout/.test(errorText);
  return fail(timeout?'AI_TIMEOUT':'WORKFLOW_FAILED',
    timeout?'AI 응답 대기시간을 초과했습니다. 입력은 저장되어 있습니다.':'AI 구성안 호출에 실패했습니다. 입력은 저장되어 있습니다.',
    {stage:'plan_request',http_status:status||null});
}
const choice = response.choices?.[0];
if (choice?.finish_reason !== 'stop') {
  return fail('AI_RESPONSE_INVALID','AI 구성안 응답이 정상적으로 완료되지 않았습니다.',
    {stage:'plan_response',finish_reason:choice?.finish_reason ?? null});
}
const content = choice.message?.content;
if (typeof content !== 'string' || !content.trim()) {
  return fail('AI_RESPONSE_INVALID','AI 구성안 응답이 비어 있습니다.',{stage:'plan_json'});
}
let plan;
try { plan = JSON.parse(content); }
catch { return fail('AI_RESPONSE_INVALID','AI 구성안을 JSON으로 읽지 못했습니다.',{stage:'plan_json'}); }
const labels = ['Business','Problem','Target Customer','Solution','Product & Service','Market Analysis','Revenue Model'];
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x,max) => typeof x === 'string' && x.trim().length > 0 && [...x].length <= max;
const invalid = (slide,field) => fail('CONTENT_VALIDATION_FAILED',
  'AI 구성안의 항목·내용 또는 원문 근거를 확인하지 못했습니다.',{stage:'plan_validation',slide,field});
if (!object(plan) || plan.schemaVersion !== 'ir_html_plan_refs_v2' || !Array.isArray(plan.slides) || plan.slides.length !== 7) {
  return invalid(null,'schema_or_slide_count');
}
const layouts = new Set((catalog.layouts ?? []).map(x=>x.layoutId));
// The catalog is made by the request node, never by the model. Verify it against the job snapshot.
if(request.evidence_mode!=='paragraph_ids_v2'||!Array.isArray(request.evidenceCatalog)) return invalid(null,'paragraph_catalog_missing');
const evidenceById=new Map();
for(const entry of request.evidenceCatalog) {
  if(!object(entry)||typeof entry.paragraphId!=='string'||evidenceById.has(entry.paragraphId)
    ||!['original','confirmed'].includes(entry.source)||!Number.isSafeInteger(entry.start)
    ||!Number.isSafeInteger(entry.end)||entry.start<0||entry.end<=entry.start) return invalid(null,'paragraph_catalog_invalid');
  let source;
  if(entry.source==='original') {
    if(entry.sectionIndex!==null||!/^original:p[0-9]{6}$/.test(entry.paragraphId)) return invalid(null,'paragraph_catalog_source');
    source=claim.input?.originalText;
  } else {
    if(!Number.isSafeInteger(entry.sectionIndex)||entry.sectionIndex<0
      ||!entry.paragraphId.startsWith('confirmed:s'+String(entry.sectionIndex+1).padStart(4,'0')+':p')
      ||!/^confirmed:s[0-9]{4}:p[0-9]{6}$/.test(entry.paragraphId)) return invalid(null,'paragraph_catalog_source');
    source=claim.input?.confirmedSections?.[entry.sectionIndex]?.body;
  }
  if(typeof source!=='string'||entry.end>source.length||entry.text!==source.slice(entry.start,entry.end)
    ||!text(entry.text,1600)) return invalid(null,'paragraph_catalog_snapshot_mismatch');
  evidenceById.set(entry.paragraphId,entry);
}
let resolvedReferences=0;
const ids=new Set();
for(let i=0;i<7;i++) {
  const s=plan.slides[i],n=i+1;
  if(!object(s)||s.sectionLabel!==labels[i]) return invalid(n,'sectionLabel');
  // Confirmed review titles are authoritative, even if the model rewrites them.
  const sectionId=['cover','problem','target_customer','solution','product_service','market','business_model'][i];
  const confirmed=claim.input?.confirmedSections?.find(section=>section.section_id===sectionId);
  const heading=typeof confirmed?.body==='string'?/^# ([^\r\n]+)\r?\n\r?\n/.exec(confirmed.body):null;
  if(heading && text(heading[1],240)) s.headline=heading[1];
  if(typeof s.slideId!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(s.slideId)||ids.has(s.slideId)) return invalid(n,'slideId');
  ids.add(s.slideId);
  if(!text(s.headline,240)||!text(s.summary,12000)) return invalid(n,'headline_or_summary');
  if(s.layoutId!=='custom-static'&&!layouts.has(s.layoutId)) return invalid(n,'layoutId');
  if(!['supported','missing'].includes(s.contentStatus)||!Array.isArray(s.evidence)||s.evidence.length>100) return invalid(n,'evidence');
  if((s.contentStatus==='supported'&&s.evidence.length===0)||(s.contentStatus==='missing'&&s.evidence.length!==0)) return invalid(n,'contentStatus');
  const seenReferences=new Set();
  const evidence=[];
  for(const e of s.evidence) {
    if(!object(e)||typeof e.paragraphId!=='string') return invalid(n,'paragraph_reference');
    const entry=evidenceById.get(e.paragraphId);
    if(!entry) return invalid(n,'paragraph_id_not_found');
    if(seenReferences.has(e.paragraphId)) continue;
    seenReferences.add(e.paragraphId);
    // Keep the existing SQL/downstream contract: exact original text is attached by code.
    evidence.push({source:entry.source,quote:entry.text,paragraphId:entry.paragraphId});
    resolvedReferences++;
  }
  s.evidence=evidence;
}
plan.schemaVersion='ir_html_plan_v1';
// SQL applies the same byte-size limit; measure UTF-8 rather than JS string length.
if(Buffer.byteLength(JSON.stringify(plan),'utf8')>262144) return invalid(null,'plan_size');
return [{json:{...base,valid:true,plan,restored_quotes:0,resolved_references:resolvedReferences,evidence_mode:"paragraph_ids_v2",
  usage:response.usage ?? null,model:response.model ?? null,
  checks:{slide_count:7,section_order:true,quotes_in_source:true,paragraph_ids_resolved:true,
    semantic_accuracy_verified:false}}}];
