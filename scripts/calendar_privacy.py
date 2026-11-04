"""Projeção estática pública; não consulta nem grava no Supabase."""
import json,re

def snapshot(data):
    prefix='window.IASDPIAgendaData = '
    text=data.decode() if isinstance(data,bytes) else data
    if not text.startswith(prefix):raise ValueError('Snapshot da Agenda não reconhecido.')
    return json.loads(text[len(prefix):].strip().rstrip(';'))

def sanitize(contents):
    values=dict(contents)
    text=values['agenda.js'].decode()
    text,count=re.subn(r'const ministrySchedules=.*?;\nconst soundScheduleInfo=',"const ministrySchedules={'Comunicação':[],'Sonoplastia':[]};\nconst soundScheduleInfo=",text,count=1,flags=re.S)
    if count!=1:raise ValueError('Fonte histórica não reconhecida; pacote privado recusado.')
    values['agenda.js']=text.encode()
    data=snapshot(values['agenda-data.js']);data['events']=[e for e in data['events'] if e.get('kind') in ['weekly','monthly']];data['privacyProjection']='elders-only-v1'
    values['agenda-data.js']=('window.IASDPIAgendaData = '+json.dumps(data,ensure_ascii=False).replace('<','\\u003c')+';\n').encode()
    validate(values);return values

def validate(contents):
    data=snapshot(contents['agenda-data.js'])
    if data.get('privacyProjection')!='elders-only-v1' or any(e.get('kind') not in ['weekly','monthly'] for e in data['events']):raise ValueError('Agenda pública deve conter somente Ancionato; eventos vêm do backend.')
    text=contents['agenda.js'].decode();match=re.search(r'const ministrySchedules=(.*?);\nconst soundScheduleInfo=',text,re.S)
    if not match or match[1]!="{'Comunicação':[],'Sonoplastia':[]}":raise ValueError('Escalas privadas embutidas no arquivo público.')

    for name,value in contents.items():
        if not name.endswith('.js'):continue
        for declaration in re.findall(rb"const ministrySchedules=(.*?);\nconst soundScheduleInfo=",value,re.S):
            if declaration.decode()!="{'Comunicação':[],'Sonoplastia':[]}":raise ValueError('Recurso antigo expõe escalas privadas: '+name)
