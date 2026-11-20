// Code: IR 확인 제목 응답 확인 / Run Once for All Items
const input=$('IR 확인 제목 요청 준비').first().json;
const response=$input.first().json;
const identity={job_id:input.job_id,deck_id:input.deck_id,source_id:input.source_id,claim_token:input.claim_token};
try {
  if(response.choices?.[0]?.finish_reason!=='stop') throw new Error('제목 응답이 완료되지 않았습니다.');
  const content=response.choices[0].message?.content;
  if(typeof content!=='string' || content.length>20000) throw new Error('제목 응답이 올바르지 않습니다.');
  const parsed=JSON.parse(content.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i,'$1'));
  const sections=input.p_analysis.sections;
  if(!Array.isArray(parsed.titles)||parsed.titles.length!==7) throw new Error('제목 7개가 필요합니다.');
  const titles=new Map();
  for(let i=0;i<7;i++) {
    const t=parsed.titles[i];
    if(t.section_id!==sections[i].id || typeof t.title!=='string' || !t.title.trim() ||
        [...t.title.trim()].length>100 || /[\r\n\x00-\x1f]/.test(t.title)) throw new Error('제목 항목 또는 길이가 올바르지 않습니다.');
    titles.set(t.section_id,t.title.trim());
  }
  return [{json:{...identity,run:true,status:'ir_review_titles_ready',p_analysis:{...input.p_analysis,
    sections:sections.map(s=>({...s,title:titles.get(s.id)}))}}}];
} catch {
  return [{json:{...identity,run:false,error_code:'AI_INVALID_RESPONSE',validation_message:'슬라이드 제목을 생성하지 못했습니다. 다시 요청해주세요.'}}];
}
