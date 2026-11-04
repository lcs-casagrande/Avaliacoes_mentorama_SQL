"""Projeção local de referências existentes. Não consulta nem grava no Supabase."""
import json
import re
import unicodedata
import uuid

def catalog(root,rows):
    source=(root/'frontend/organization.js').read_text()
    ministries=source.split('const churchMinistries = [',1)[1].split('];',1)[0]
    entries=re.findall(r"\{name:'([^']+)',responsibles:\[([^\]]*)\]\}",ministries)
    departments=[];people=[];memberships=[];aliases={};legacy=[]
    def identity(kind,label):return str(uuid.uuid5(uuid.NAMESPACE_URL,'iasdpi-local-reference:'+kind+':'+label))
    def department(name):
        if name.startswith('Diaconato —'):name='Diaconato'
        if name=='Ministério da Música':name='Música'
        found=next((d for d in departments if d['name']==name),None)
        if found:return found
        code=re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFD',name).encode('ascii','ignore').decode().lower()).strip('-')
        row=dict(id=identity('department',name),name=name,code=code,active=True,version=1,can_manage=True,can_roster=True);departments.append(row);return row
    def person(name):
        # Correspondência textual exata; nenhum agrupamento por apelido/semelhança.
        name=unicodedata.normalize('NFC',name.strip())
        found=next((p for p in people if p['name']==name),None)
        if found:return found
        row=dict(id=identity('person',name),name=name,display_name=name,active=True,version=1,max_monthly_count=None);people.append(row);return row
    def link(p,d,head=False,origin='Referência informada'):
        found=next((m for m in memberships if m['person_id']==p['id'] and m['department_id']==d['id']),None)
        if found:found['is_ministry_head']=found['is_ministry_head'] or head;return found
        row=dict(id=identity('membership',p['id']+':'+d['id']),person_id=p['id'],department_id=d['id'],active=True,version=1,is_ministry_head=head,max_monthly_count=None,desired_monthly_count=None,preferences=origin+'; habilitação e disponibilidade pendentes de confirmação.');memberships.append(row);return row
    for name in ['Sonoplastia','Diaconato','Música','Ancionato','Comunicação']:department(name)
    for row in rows:
        # Grafia atual explicitamente solicitada; texto histórico permanece intocado.
        name='Simone/Profª de Pilates' if row['person']=='Simone/Profªde Pilates 🧘' else row['person']
        p=person(name);d=department(row['department']);link(p,d,origin='Participação em escala manual histórica')
        aliases[row['person']]=p['id'];legacy.append(dict(source_key=row['id'],person_id=p['id'],department_id=d['id'],date=row['date'],original_name=row['person']))
    for name,names in entries:
        d=department(name)
        for responsible in re.findall(r"'([^']+)'",names):link(person(responsible),d,True,'Responsável ministerial informado no organograma')
    # A Agenda identifica os anciãos pelo nome completo. Não consolidar nomes
    # abreviados do organograma ou de outros ministérios por semelhança.
    agenda=json.loads((root/'frontend/agenda-data.js').read_text().split('=',1)[1].strip().rstrip(';'))
    elders=sorted({e['person'] for e in agenda.get('events',[]) if e.get('kind') in ['monthly','weekly'] and e.get('person')})
    for name in elders:link(person(name),department('Ancionato'),False,'Ancião da semana/mês informado na Agenda; habilitação e disponibilidade não confirmadas')
    return dict(actor_id=identity('actor','administrador-local'),is_admin=True,reference_preview=True,departments=departments,people=people,memberships=memberships,roles=[],qualifications=[],availability=[],access=[]),legacy

def test_scenario():
    """Dados sintéticos separados das referências da liderança."""
    uid=lambda key:str(uuid.uuid5(uuid.NAMESPACE_URL,'iasdpi-confirmation-test:'+key))
    names=[('sonoplastia','Sonoplastia'),('diaconato','Diaconato'),('musica','Música'),('ancionato','Ancionato'),('comunicacao','Comunicação')]
    departments=[dict(id=uid(code),code=code,name=name,active=True,version=1,can_manage=True,can_roster=True) for code,name in names]
    people=[dict(id=uid(letter),name='Voluntário '+letter+' — teste',display_name='Voluntário '+letter+' — teste',active=True,version=1,max_monthly_count=None) for letter in 'ABCD']
    roles=[dict(id=uid('role:'+d['code']),department_id=d['id'],name='Função fictícia de teste — '+d['name'],active=True,version=1) for d in departments]
    memberships=[];qualifications=[]
    for i,indices in enumerate([[0,2],[0,2],[1,4],[3]]):
        for index in indices:
            m=dict(id=uid('member:'+str(i)+':'+str(index)),person_id=people[i]['id'],department_id=departments[index]['id'],active=True,version=1,is_ministry_head=False,max_monthly_count=None,desired_monthly_count=None)
            memberships.append(m);qualifications.append(dict(membership_id=m['id'],department_id=m['department_id'],role_id=roles[index]['id']))
    availability=[dict(id=uid('availability:'+p['id']),person_id=p['id'],department_id=None,kind='available',pattern='weekly',weekdays=[0,3,6],active=True,version=1,origin='manual') for p in people]
    return dict(actor_id=uid('actor'),is_admin=True,reference_preview=False,departments=departments,people=people,memberships=memberships,roles=roles,qualifications=qualifications,availability=availability,access=[]),[]
