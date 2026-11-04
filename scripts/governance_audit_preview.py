"""Composição exclusiva da prévia G6; nenhum arquivo de produção é alterado."""
import json
import re
import uuid
import schedule_reference_preview

def fixture(root):
    agenda=(root/'frontend/agenda.js').read_text()
    manual=agenda[agenda.index('const ministrySchedules='):agenda.index('const soundScheduleInfo=')]
    rows=[]
    for department,part in re.findall(r"'([^']+)':\[(.*?)\]",manual,re.S):
        for day,name in re.findall(r"date:'([^']+)',person:'([^']+)'",part):rows.append({'date':day,'person':name,'department':department,'id':'legacy:'+department+':'+day+':'+name,'role':None,'origin':'Escala manual informada'})
    data,legacy=schedule_reference_preview.catalog(root,rows)
    codes=['sonoplastia','diaconato','musica','ancionato','comunicacao','ministerio-da-familia','ministerio-da-crianca']
    old=[d for d in data['departments'] if d['code'] in codes]
    remap={d['id']:f'00000000-0000-4000-8000-{codes.index(d["code"])+1:012d}' for d in old}
    data['departments']=old
    for d in old:d['id']=remap[d['id']]
    data['memberships']=[m for m in data['memberships'] if m['department_id'] in remap]
    for m in data['memberships']:m['department_id']=remap[m['department_id']]
    data['people']=[p for p in data['people'] if any(m['person_id']==p['id'] for m in data['memberships'])]
    for row in legacy:row['department_id']=remap[row['department_id']]
    data['roles']=[{'id':str(uuid.uuid5(uuid.NAMESPACE_URL,'g6-demo-role:'+d['id'])),'department_id':d['id'],'name':'Participação no departamento','general_assignment':True,'active':True,'version':1} for d in old]
    data['reference_preview']=True
    seed={'catalog':data,'rows':rows,'legacy':legacy,'simplified_daily':True,'elder_periods':True,'review_ready':True}
    runtime=(root/'tests/fixtures/schedule-demo-runtime.js').read_text()
    runtime=runtime[runtime.index('window.IASDPISchedulePreview='):]
    start=runtime.index(' const id=n=>');end=runtime.index(' const details=',start)
    runtime=runtime[:start]+' const c=IASDPIKnownPreviewSeed.catalog;\n'+runtime[end:]
    runtime=re.sub(r"  if\(name==='iasdpi_find_account'\).*?;\n",'',runtime)
    text='window.IASDPIG6Preview={};window.IASDPIKnownPreviewSeed='+json.dumps(seed,ensure_ascii=False)+';\n'+runtime+'\n'
    known=(root/'tests/fixtures/schedule-known-preview.js').read_text()
    known=known[:known.index(' const draw=render;')]+'})();'
    text+=known+'\nwindow.IASDPIB1Preview=IASDPIKnownPreview;IASDPIB1Preview.monthlyReady=Promise.resolve();window.IASDPICalendarOfficialSource=()=>window.IASDPIAgendaData;\n'
    elder=(root/'tests/fixtures/schedule-elder-periods-preview.js').read_text()
    # Apenas a composição G6 habilita as preferências existentes para homologação.
    elder=elder.replace('source=()=>IASDPICalendarOfficialSource().events||[]','source=()=>[]')
    elder=elder.replace("availability_enabled:false","availability_enabled:true").replace('result.availability_enabled=false;','result.availability_enabled=true;')
    elder=elder.replace("if(name==='iasdpi_schedule_save'&&args.p_entity==='availability')", "if(false&&name==='iasdpi_schedule_save'&&args.p_entity==='availability')")
    elder=elder.replace("if(name==='iasdpi_schedule_member_save'&&", "if(false&&name==='iasdpi_schedule_member_save'&&")
    text+=elder+'\n'+(root/'tests/fixtures/portal-integration-preview.js').read_text()+'\n'+(root/'tests/fixtures/governance-integration-preview.js').read_text()
    return text
