// HTML 부분 보정 화면 검사 결과 / Run Once for All Items
// After one repair, accept residual visual quality issues without another AI call.
const saved=$('HTML 부분 보정 저장 확인').first().json;
const context=$('HTML 생성 자료 조회').first().json;
const items=$input.all(),response=items[0]?.json;
const base={job_id:saved.job_id,claim_token:saved.claim_token,
  document_id:saved.document_id,document_md5:saved.document_md5};
const allowedErrors=new Set(['HTML_OVERFLOW','HTML_VALIDATION_FAILED','WORKFLOW_FAILED']);
const failure=(code,reason)=>[{json:{...base,render_verified:false,repair_required:false,
  error_code:allowedErrors.has(code)?code:'WORKFLOW_FAILED',
  message:'슬라이드 화면 검사를 완료하지 못했습니다. 입력은 저장되어 있습니다.',
  diagnostic:{stage:'partial_repair_browser_result',reason}}}];
if(saved.candidate_ok!==true||context.job_id!==saved.job_id) return failure('WORKFLOW_FAILED','candidate_not_confirmed');
if(items.length!==1||!response||response.error) return failure('WORKFLOW_FAILED','browser_request_failed');
if(response.render_ok!==true&&!['HTML_OVERFLOW','HTML_VALIDATION_FAILED'].includes(response.error_code)) {
  return failure('WORKFLOW_FAILED','browser_rejected_or_unavailable');
}
const normalizedHash=response.contrast_saved===true&&response.source_document_md5===saved.document_md5
 &&typeof response.document_md5==='string'&&/^[a-f0-9]{32}$/.test(response.document_md5);
if(response.job_id!==saved.job_id||response.document_id!==saved.document_id
  ||(response.document_md5!==saved.document_md5&&!normalizedHash)||response.image_revision!==saved.image_revision) {
  return failure('WORKFLOW_FAILED','document_identity_or_revision_mismatch');
}
base.document_md5=response.document_md5;
if(response.renderer_version!=='ir_html_browser_v1'||response.render_checked!==true
  ||!Number.isSafeInteger(response.elapsed_ms)||response.elapsed_ms<0||response.elapsed_ms>300000) {
  return failure('WORKFLOW_FAILED','renderer_contract_mismatch');
}
const report=response.report,expected=context.fullDeckPlan?.slides;
if(!report||typeof report.passed!=='boolean'||report.fonts_loaded!==true||report.slide_count!==7
  ||!Array.isArray(report.slides)||report.slides.length!==7||!Array.isArray(expected)||expected.length!==7
  ||report.contrast_scope!=='solid_background_html_text_only'||report.semantic_accuracy_verified!==false) {
  return failure('HTML_VALIDATION_FAILED','render_report_incomplete');
}
const qualityCodes=new Set(['ELEMENT_OUTSIDE_SLIDE','CONTENT_OVERFLOW','TEXT_OUTSIDE_SLIDE',
  'CLIPPED_TEXT','LOW_TEXT_CONTRAST','INVISIBLE_TEXT','NO_VISIBLE_TEXT','CANVAS_SIZE']);
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000;
const slides=[];
let remaining=0;
for(let i=0;i<7;i++) {
  const slide=report.slides[i];
  if(!slide||slide.slideId!==expected[i].slideId||typeof slide.passed!=='boolean'
    ||!Array.isArray(slide.issues)||slide.issues.length>30||!count(slide.contrast_checked)
    ||!count(slide.contrast_unchecked)||!count(slide.text_nodes)) {
    return failure('HTML_VALIDATION_FAILED','slide_report_incomplete');
  }
  const quality=[];
  for(const issue of slide.issues) {
    if(!issue||!qualityCodes.has(issue.code)) return failure('HTML_VALIDATION_FAILED','non_visual_issue');
    quality.push({code:issue.code,...(typeof issue.tag==='string'?{tag:issue.tag.slice(0,64)}:{})});
  }
  if(slide.passed!==(quality.length===0)||
    (slide.text_nodes===0&&!quality.some(issue=>issue.code==='NO_VISIBLE_TEXT'))) {
    return failure('HTML_VALIDATION_FAILED','slide_report_inconsistent');
  }
  remaining+=quality.length;
  slides.push({slideId:slide.slideId,passed:true,issues:[],visual_passed:slide.passed,
    quality_issues:quality,contrast_checked:slide.contrast_checked,
    contrast_unchecked:slide.contrast_unchecked,text_nodes:slide.text_nodes});
}
if(report.passed!==(remaining===0)||response.render_ok!==report.passed) {
  return failure('HTML_VALIDATION_FAILED','render_report_inconsistent');
}
return [{json:{...base,render_verified:true,repair_required:false,renderer_version:response.renderer_version,
  image_revision:response.image_revision,render_elapsed_ms:response.elapsed_ms,
  render_report:{passed:true,fonts_loaded:true,slide_count:7,slides,
    contrast_scope:'solid_background_html_text_only',semantic_accuracy_verified:false,
    contrast_policy:'auto_then_accept_v2',
    contrast_remaining:count(report.contrast_remaining)?report.contrast_remaining:0,
    ...(remaining>0?{visual_policy:'after_one_repair_v1',visual_passed:false,quality_remaining:remaining}: {})},
  warnings:[],ready:false}}];
