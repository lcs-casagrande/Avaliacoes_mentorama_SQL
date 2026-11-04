"""Compara inventários somente leitura. Nunca conecta ao banco nem executa SQL."""
import argparse,json
from pathlib import Path
def validate(d):
    if not isinstance(d,dict) or d.get('format')!='IASDPI_G9_SCHEMA_SNAPSHOT' or d.get('version')!=1 or not isinstance(d.get('markers'),list) or not isinstance(d.get('relations'),list) or not isinstance(d.get('functions'),list):raise ValueError('Snapshot G9 inválido ou incompleto.')
    if len(d['markers'])!=19 or any(type(x.get('present')) is not bool for x in d['markers']) or {x.get('number') for x in d['markers']}!=set(range(1,20)):raise ValueError('Marcadores incompletos.')
    return d
def readiness(d):
    d=validate(d);m={x['number']:x['present'] for x in d['markers']};core=all(m[i] for i in range(1,5))
    if not core:return {'state':'core_unconfirmed','can_plan_005_019':False,'reason':'Confirmar/revisar base 001–004; não reaplicar por suposição.'}
    if m[11] and not all(m[i] for i in range(5,11)):return {'state':'church_before_schedules','can_plan_005_019':False,'reason':'011 pode existir sem Escalas; não instalar 005–010 depois dela sem adaptação específica.'}
    if not any(m[i] for i in range(5,20)):return {'state':'core_004_candidate','can_plan_005_019':True,'reason':'Somente marcadores compatíveis com 001–004. Comparar schema e revisar backup antes de autorizar.'}
    if all(m[i] for i in range(5,20)):return {'state':'target_markers_present','can_plan_005_019':False,'reason':'Não reaplicar. Comparar definições e checks; marcadores não comprovam execução dos arquivos.'}
    return {'state':'partial_or_older_stage','can_plan_005_019':False,'reason':'Instalação parcial/etapa anterior exige inventário e plano apenas das etapas ausentes; 018 não tem marcador exclusivo.'}
def compare(expected,observed):
    expected=validate(expected);observed=validate(observed);changes={}
    for section,key in [('relations','name'),('functions',None),('schemas','name')]:
        identity=lambda v:v[key] if key else v['schema']+'.'+v['name']+'('+v['arguments']+')'
        left={identity(v):v for v in expected.get(section,[])};right={identity(v):v for v in observed.get(section,[])}
        changes[section]={'missing':sorted(left.keys()-right.keys()),'extra':sorted(right.keys()-left.keys()),'changed':sorted(k for k in left.keys()&right.keys() if left[k]!=right[k])}
    exact=all(not values for group in changes.values() for values in group.values())
    return {'observed_readiness':readiness(observed),'structure_matches':exact,'changes':changes,'data_fingerprints_compared':False,'provider_auth_settings_verified':False,'warning':'Dados reais nunca são comparados aos valores sintéticos. Divergências de ambiente/provedor exigem revisão, não SQL corretivo automático.'}
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--expected',type=Path,required=True);p.add_argument('--observed',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();result=compare(json.loads(a.expected.read_text()),json.loads(a.observed.read_text()));a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(a.output)
