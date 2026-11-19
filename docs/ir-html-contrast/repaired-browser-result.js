// HTML 부분 보정 화면 검사 결과 / Run Once for All Items. Never loop back to AI.
// n8n Code: Run Once for All Items. No AI calls, HTML rendering, or database writes.
const saved=$('HTML 부분 보정 저장 확인').first().json;
const context=$('HTML 생성 자료 조회').first().json;
const items=$input.all(),response=items[0]?.json;
const base={job_id:saved.job_id,claim_token:saved.claim_token,
  document_id:saved.document_id,document_md5:saved.document_md5};
const allowed=new Set(['HTML_OVERFLOW','HTML_VALIDATION_FAILED','WORKFLOW_FAILED']);
const failure=(code,reason)=>[{json:{...base,render_verified:false,repair_required:false,
  error_code:allowed.has(code)?code:'WORKFLOW_FAILED',
  message:code==='HTML_OVERFLOW'?'슬라이드에 넘치거나 잘리는 내용이 있어 생성 완료로 저장하지 못했습니다.'
    :'슬라이드 화면 검사를 완료하지 못했습니다. 입력은 저장되어 있습니다.',
  diagnostic:{stage:'partial_repair_browser_result',reason}}}];
if(saved.candidate_ok!==true||context.job_id!==saved.job_id) return failure('WORKFLOW_FAILED','candidate_not_confirmed');
if(items.length!==1||!response||response.error) return failure('WORKFLOW_FAILED','browser_request_failed');
if(response.render_ok!==true) {
  return failure(response.error_code,
    typeof response.reason==='string'?response.reason.slice(0,200):'browser_rejected_or_unavailable');
}
const normalizedHash=response.contrast_saved===true&&response.source_document_md5===saved.document_md5
 &&typeof response.document_md5==='string'&&/^[a-f0-9]{32}$/.test(response.document_md5);
if(response.job_id!==saved.job_id||response.document_id!==saved.document_id
  ||(response.document_md5!==saved.document_md5&&!normalizedHash)||response.image_revision!==saved.image_revision) {
  return failure('WORKFLOW_FAILED','document_identity_or_revision_mismatch');
}
base.document_md5=response.document_md5;
if(response.renderer_version!=='ir_html_browser_v1'||response.render_checked!==true
  ||!Number.isSafeInteger(response.elapsed_ms)||response.elapsed_ms<0) {
  return failure('WORKFLOW_FAILED','renderer_contract_mismatch');
}
const report=response.report,expected=context.fullDeckPlan?.slides;
if(!report||report.passed!==true||report.fonts_loaded!==true||report.slide_count!==7
  ||!Array.isArray(report.slides)||report.slides.length!==7||!Array.isArray(expected)||expected.length!==7
  ||report.contrast_scope!=='solid_background_html_text_only'||report.semantic_accuracy_verified!==false) {
  return failure('HTML_VALIDATION_FAILED','render_report_incomplete');
}
const count=n=>Number.isSafeInteger(n)&&n>=0;
const slides=[];
for(let i=0;i<7;i++) {
  const slide=report.slides[i];
  if(!slide||slide.slideId!==expected[i].slideId||slide.passed!==true
    ||!Array.isArray(slide.issues)||slide.issues.length!==0||!count(slide.contrast_checked)
    ||!count(slide.contrast_unchecked)||!count(slide.text_nodes)||slide.text_nodes===0) {
    return failure('HTML_VALIDATION_FAILED','slide_report_not_passed');
  }
  slides.push({slideId:slide.slideId,passed:true,issues:[],contrast_checked:slide.contrast_checked,
    contrast_unchecked:slide.contrast_unchecked,text_nodes:slide.text_nodes});
}
const unchecked=slides.reduce((total,s)=>total+s.contrast_unchecked,0);
return [{json:{...base,render_verified:true,repair_required:false,renderer_version:response.renderer_version,
  image_revision:response.image_revision,render_elapsed_ms:response.elapsed_ms,
  render_report:{passed:true,fonts_loaded:true,slide_count:7,slides,
    contrast_scope:'solid_background_html_text_only',semantic_accuracy_verified:false,
    ...(report.contrast_policy==='auto_then_accept_v2'?{contrast_policy:report.contrast_policy,contrast_remaining:Number.isSafeInteger(report.contrast_remaining)&&report.contrast_remaining>=0?report.contrast_remaining:0}: {})},
  warnings:report.contrast_policy!=='auto_then_accept_v2'&&unchecked>0?[{code:'PARTIAL_CONTRAST_CHECK',message:'SVG 또는 복합 배경의 일부 글자 대비는 자동 검사 범위에 포함되지 않았습니다.'}]:[],
  ready:false}}];
