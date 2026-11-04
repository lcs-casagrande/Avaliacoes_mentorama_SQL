"""Gera inventário de revisão; nunca executa SQL nem chama Supabase."""
import argparse,hashlib,json,re,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
from calendar_privacy import snapshot

def prepare(existing=None):
    known=(existing or {}).get('events',[]);source=snapshot((ROOT/'frontend/agenda-data.js').read_bytes());events=[];schedules=[]
    for row in source['events']:
        if row['kind']!='event':continue
        matches=[e for e in known if e.get('source_key')==row['id']]
        candidates=[e['id'] for e in known if e.get('title')==row['title'] and e.get('date')==row['startDate'] and e.get('source_key')!=row['id']]
        events.append({'source_key':row['id'],'existing_ids':[e['id'] for e in matches],'possible_matches':candidates,'proposed_id':matches[0]['id'] if len(matches)==1 else str(uuid.uuid5(uuid.NAMESPACE_URL,'IASD_PI:'+row['id'])),'original':row,'program_category':None,'organizer_kind':None,'audience':None,'is_restricted':None,'review_required':True})
    text=(ROOT/'frontend/agenda.js').read_text();part=text[text.index('const ministrySchedules='):text.index('const soundScheduleInfo=')]
    for dept,rows in re.findall(r"'([^']+)':\[(.*?)\]",part,re.S):
        for date,name in re.findall(r"date:'([^']+)',person:'([^']+)'",rows):schedules.append({'source_key':'legacy:'+dept+':'+date+':'+name,'date':date,'original_name':name,'department':dept,'person_id':None,'department_id':None,'review_required':True})
    if len(schedules)!=20:raise ValueError('Esperados 15 registros de Sonoplastia e cinco de Comunicação; revisar fonte.')
    return {'church':'IASD_PI','writes_executed':0,'safe_to_apply':False,'existing_inventory_supplied':existing is not None,'events':events,'schedules':schedules,'source_sha256':hashlib.sha256((ROOT/'frontend/agenda-data.js').read_bytes()).hexdigest(),'notes':['Não executar importação automática. Confirmar correspondências, identidades e vínculos antes de chamar RPCs.','Classificações, organizador, público e restrição não foram inferidos.','Após conciliação, reutilizar iasdpi_schedule_register_legacy para históricos; iasdpi_event_save para eventos, com revisão de publicação.']}
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--existing',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    if a.output.exists():p.error('Destino existente; nenhum arquivo sobrescrito.')
    result=prepare(json.loads(a.existing.read_text()) if a.existing else None);a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('Inventário gerado: %s eventos, %s escalas; zero gravações remotas.'%(len(result['events']),len(result['schedules'])))
