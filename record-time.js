'use strict';
// Leitura tolerante, sem mutações. Valores desconhecidos não viram horários fictícios.
const recordClockPattern=/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/;
function recordDay(value){
  if(typeof value!=='string')return '';
  let day=value;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(day))day=day.split('/').reverse().join('-');
  if(/^\d{4}-\d{2}-\d{2}$/.test(day)){
    const date=new Date(day+'T12:00:00Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day?day:'';
  }
  if(/^\d{4}-\d{2}-\d{2}[T ]/.test(day)){
    const instant=inspectRecordTime(day);
    return instant.valid?instant.day:'';
  }
  return '';
}
function saoPauloInstant(day,clock){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!recordClockPattern.test(clock||''))return null;
  const full=clock.length===5?clock+':00':clock;
  const target=Date.parse(day+'T'+full.slice(0,8)+'Z');if(!Number.isFinite(target))return null;
  let epoch=target;
  const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let n=0;n<4;n++){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(p=>[p.type,p.value]));
    const shown=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    if(shown===target){
      const offset=(target-epoch)/60000,absolute=Math.abs(offset);
      return day+'T'+full+(offset>=0?'+':'-')+String(Math.floor(absolute/60)).padStart(2,'0')+':'+String(absolute%60).padStart(2,'0');
    }
    epoch+=target-shown;
  }
  return null; // Horário civil inexistente na mudança de fuso: revisão manual.
}
function inspectRecordTime(value,day){
  const empty=value===null||value===undefined||value==='';
  if(empty)return {valid:false,empty:true,clock:'',epoch:null,iso:null};
  if(value instanceof Date){if(!Number.isFinite(value.getTime()))return {valid:false,empty:false,clock:'',epoch:null,iso:null};value=value.toISOString();}
  if(typeof value!=='string')return {valid:false,empty:false,clock:String(value),epoch:null,iso:null};
  if(recordClockPattern.test(value)){
    const iso=saoPauloInstant(day,value);
    return {valid:true,empty:false,clock:value.length===5?value+':00':value,epoch:iso?Date.parse(iso):null,iso,day,absolute:false};
  }
  const match=value.match(/^(\d{4}-\d{2}-\d{2})[T ]((?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  if(!match||!recordDay(match[1]))return {valid:false,empty:false,clock:value,epoch:null,iso:null};
  const full=match[2].length===5?match[2]+':00':match[2];
  let offset=match[3]||'';
  if(/^[+-]\d{2}$/.test(offset))offset+=':00';
  if(/^[+-]\d{4}$/.test(offset))offset=offset.slice(0,3)+':'+offset.slice(3);
  const iso=offset?match[1]+'T'+full+offset.toUpperCase():saoPauloInstant(match[1],full);
  const epoch=iso?Date.parse(iso):NaN;
  if(!Number.isFinite(epoch))return {valid:false,empty:false,clock:value,epoch:null,iso:null};
  const clock=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(epoch))+(full.match(/\.\d+$/)?.[0]||'');
  return {valid:true,empty:false,clock,epoch,iso,absolute:Boolean(offset),day:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(epoch))};
}
function recordClock(value,day){const parsed=inspectRecordTime(value,day);return parsed.empty?'':parsed.valid?parsed.clock:String(value);}
function recordEpoch(value,day){const result=inspectRecordTime(value,day);return result.valid?result.epoch:null;}
function recordInstant(day,clock){
  const parsed=inspectRecordTime(clock,recordDay(day));
  if(!parsed.valid||!parsed.iso)throw Error('Horário ou data inconsistente. Corrija o campo antes de salvar.');
  return parsed.iso;
}
function plannedClock(value){return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d:00(?:\.0+)?$/.test(value)?value.slice(0,5):value;}
function programForMetrics(original){
  const p={...original},rawPlan=original?.plan||{},day=recordDay(rawPlan.date);
  const instant=(value,fallback)=>value===null||value===undefined||value===''?(fallback?saoPauloInstant(day,fallback):null):inspectRecordTime(value,day).iso;
  p.plan={...rawPlan,items:(Array.isArray(rawPlan.items)?rawPlan.items:[]).map(item=>({...item,planned_start:instant(item.planned_start,item.start),planned_end:instant(item.planned_end,item.end)}))};
  p.executions=Object.fromEntries(Object.entries(original?.executions||{}).map(([id,e])=>[id,{...e,started:instant(e?.started),ended:instant(e?.ended)}]));
  p.planned_start=instant(original?.planned_start,rawPlan.start);p.planned_end=instant(original?.planned_end,rawPlan.end);
  return p;
}
function importedTimeWarning(value,day){
  const parsed=inspectRecordTime(value,recordDay(day));
  if(parsed.empty)return '';
  if(!parsed.valid)return 'Horário importado inválido. Revise o valor original e digite HH:mm:ss.';
  if(parsed.day&&recordDay(day)&&parsed.day!==recordDay(day))return 'Horário em outra data. Confira a data do culto e corrija este horário manualmente.';
  return '';
}

// Formatação de apresentação: nunca altera os documentos ou sua precisão original.
function displayPlannedTime(value){
  const parsed=inspectRecordTime(value);
  return parsed.empty?'':parsed.valid?parsed.clock.slice(0,5):String(value);
}
function displayRecordTimestamp(value){
  const parsed=inspectRecordTime(value);
  return parsed.valid&&parsed.day?parsed.day.split('-').reverse().join('/')+' '+parsed.clock.slice(0,8):'Data não informada';
}
