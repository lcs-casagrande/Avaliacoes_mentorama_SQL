import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({window:{},Intl,Date});
vm.runInContext(fs.readFileSync('frontend/record-time.js','utf8'),context);
const agenda=fs.readFileSync('frontend/agenda.js','utf8');
vm.runInContext(agenda.slice(agenda.indexOf('// E2: planejamento puro'),agenda.indexOf('// E1: publicação editorial')),context);
const p=context.window.IASDPIEventPlanning,plain=v=>JSON.parse(JSON.stringify(v));
test('ano-limite usa America/Sao_Paulo e muda dinamicamente',()=>{
 assert.equal(p.yearEnd(new Date('2027-01-01T01:00:00Z')),'2026-12-31');
 assert.equal(p.yearEnd(new Date('2027-01-01T04:00:00Z')),'2027-12-31');
});
test('semanal em sábados até dezembro, sem alterar a entrada',()=>{
 const event={date:'2026-11-01',end_date:'2026-11-01',recurrence:'weekly',recurrence_weekday:6};const before=JSON.stringify(event),days=p.occurrences(event,'2026-12-31').map(e=>e.date);
 assert.equal(days[0],'2026-11-07');assert.equal(days.at(-1),'2026-12-26');assert.equal(days.length,8);assert.equal(JSON.stringify(event),before);
});
test('primeira quinta e último domingo com calendário real',()=>{
 const event={date:'2026-11-01',recurrence:'monthly',recurrence_weekday:4,recurrence_ordinal:1};
 assert.deepEqual(plain(p.occurrences(event,'2026-12-31').map(e=>e.date)),['2026-11-05','2026-12-03']);
 assert.deepEqual(plain(p.occurrences({...event,recurrence_weekday:0,recurrence_ordinal:-1},'2026-12-31').map(e=>e.date)),['2026-11-29','2026-12-27']);
});
test('não gera série após o limite ou com data impossível',()=>{
 assert.throws(()=>p.occurrences({date:'2027-01-01',recurrence:'weekly'},'2026-12-31'),/ultrapassa/);
 assert.throws(()=>p.occurrences({date:'2026-02-30',recurrence:'weekly'},'2026-12-31'),/válida/);
});
const places=[{code:'nave',name:'Nave',exclusive:true},{code:'salas',name:'Salas',exclusive:false}],event={id:'a',title:'Evento A',date:'2026-11-07',end_date:'2026-11-07',start_time:'14:00',end_time:'16:00',spaces:['nave']};
test('bloqueia sobreposição, libera limites adjacentes e espaços compartilhados',()=>{
 assert.equal(p.conflicts(event,[{...event,id:'b',start_time:'15:00',end_time:'17:00'}],places).length,1);
 assert.equal(p.conflicts(event,[{...event,id:'b',start_time:'16:00',end_time:'17:00'}],places).length,0);
 assert.equal(p.conflicts({...event,spaces:['salas']},[{...event,id:'b',spaces:['salas']}],places).length,0);
});
test('dia inteiro ocupa o dia e registros sem local relacionado não derrubam a consulta',()=>{
 assert.equal(p.conflicts(event,[{...event,id:'b',all_day:true,start_time:null,end_time:null}],places).length,1);
 assert.equal(p.conflicts(event,[{...event,id:'b',start_time:'17:00',end_time:'15:00',spaces:[]}],places).length,0);
 assert.equal(p.conflicts(event,[{...event,id:'b',start_time:null,end_time:null}],places)[0].time_pending,true);
});
