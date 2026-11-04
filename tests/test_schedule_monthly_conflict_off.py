"""Exceção apenas do Ancião do mês; todos os dados abaixo são cópias descartáveis."""
import shutil
import unittest
import test_frontend_access as base
import test_schedule_elder_periods as elders

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class MonthlyConflictOffTests(unittest.TestCase):
    setUpClass=classmethod(elders.ElderPeriodsTests.setUpClass.__func__)
    tearDownClass=classmethod(elders.ElderPeriodsTests.tearDownClass.__func__)
    setUp=elders.ElderPeriodsTests.setUp
    tearDown=elders.ElderPeriodsTests.tearDown
    catalog=elders.ElderPeriodsTests.catalog
    elder=elders.ElderPeriodsTests.elder
    person=elders.ElderPeriodsTests.person
    month=elders.ElderPeriodsTests.month
    def shared(self):
        self.page.evaluate("""async()=>{
         const rpc=IASDPISchedulePreview.request,c=await rpc('iasdpi_schedule_catalog'),person=c.people.find(p=>p.name==='Adriano Borrego'),sono=c.departments.find(d=>d.code==='sonoplastia'),elder=c.departments.find(d=>d.code==='ancionato');
         await rpc('iasdpi_schedule_save',{p_entity:'membership',p_id:crypto.randomUUID(),p_expected_version:0,p_request_id:crypto.randomUUID(),p_data:{person_id:person.id,department_id:sono.id,active:true}});
         const event=await rpc('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:sono.id,date:'2027-02-03',title:'Evento descartável de teste'}}),role=c.roles.find(r=>r.department_id===sono.id&&r.general_assignment);
         window.monthConflictTest={rpc,c,person,sono,elder,event,planId:crypto.randomUUID(),data:{department_id:sono.id,month:'2027-02-01',title:'Teste isolado',status:'published',requirements:[{id:crypto.randomUUID(),event_id:event.id,role_id:role.id,required_count:1,notes:'Nota preservada',assignments:[{id:crypto.randomUUID(),person_id:person.id,timing_mode:'day',starts_at:null,ends_at:null}]}]}};
         monthConflictTest.period=async(kind,status='published')=>{const w=await rpc('iasdpi_schedule_elder_workspace',{p_department:elder.id,p_month:'2027-02-01'}),row=w.periods.find(r=>r.kind===kind);return rpc('iasdpi_schedule_elder_save',{p_department:elder.id,p_status:status,p_rows:[{...row,person_id:person.id,expected_version:row.version}],p_request_id:crypto.randomUUID()});};
         monthConflictTest.daily=()=>rpc('iasdpi_schedule_plan_save',{p_id:monthConflictTest.planId,p_expected_version:0,p_data:monthConflictTest.data,p_request_id:crypto.randomUUID()});
        }""")
    def test_monthly_conflict_disabled_in_manual_and_rotation_but_weekly_active(self):
        self.shared();result=self.page.evaluate("""()=>{const t=monthConflictTest,e=IASDPIElderPeriods,rows=e.periods('2027-02'),person=t.person.id,busy=[{person_id:person,department_id:t.sono.id,status:'published',date:'2027-02-03'}],monthly=rows.find(r=>r.kind==='monthly'),weekly=rows.find(r=>r.kind==='weekly'),catalog={...t.c,people:[t.person]};return {monthly:e.reasons(catalog,t.elder.id,monthly,person,busy),weekly:e.reasons(catalog,t.elder.id,weekly,person,busy),suggested:e.propose([monthly],catalog,t.elder.id,busy).rows[0].person_id};}""")
        self.assertEqual(result['monthly'],[]);self.assertTrue(any('Conflito' in reason for reason in result['weekly']));self.assertEqual(result['suggested'],self.person())
    def test_published_daily_allows_monthly_selection_save_and_publication(self):
        self.shared();self.page.evaluate('monthConflictTest.daily()');before=self.page.evaluate("JSON.stringify(IASDPIKnownPreview.plans.get(monthConflictTest.sono.id+':2027-02-01'))")
        self.elder();self.month('2027-02');self.assertTrue(self.page.locator('[data-elder-person]').first.locator('option[value="'+self.person()+'"]').evaluate('e=>e.disabled'))
        self.page.locator('[data-kind=monthly]').click();field=self.page.locator('[data-elder-period="monthly:2027-02-01"] select');self.assertFalse(field.locator('option[value="'+self.person()+'"]').evaluate('e=>e.disabled'));field.select_option(self.person())
        self.page.locator('[data-elder-action=save]').click();self.page.wait_for_function("document.querySelector('#elder-feedback').textContent.includes('confirmadas')");self.page.evaluate("monthConflictTest.period('monthly')")
        self.assertEqual(before,self.page.evaluate("JSON.stringify(IASDPIKnownPreview.plans.get(monthConflictTest.sono.id+':2027-02-01'))"));self.assertTrue(self.page.evaluate("IASDPIScheduleCalendar.periods().some(r=>r.kind==='monthly'&&r.startDate==='2027-02-01'&&r.person==='Adriano Borrego')"))
    def test_published_monthly_allows_daily_choice_rotation_and_publication(self):
        self.shared();self.page.evaluate("monthConflictTest.period('monthly')")
        result=self.page.evaluate("""async()=>{const t=monthConflictTest,context=await t.rpc('iasdpi_schedule_rotation_context',{p_department:t.sono.id,p_month:'2027-02-01'}),day=context.people.find(p=>p.person_id===t.person.id).days.find(d=>d.date==='2027-02-03'),source={catalog:{...await t.rpc('iasdpi_schedule_catalog'),people:[t.person]},department:t.sono.id,context,events:[t.event],plan:{...structuredClone(t.data),version:0}};source.plan.requirements[0].assignments=[];const proposal=IASDPIScheduleRotation.propose(source);await t.daily();return {conflict:day.conflict,suggested:proposal.plan.requirements[0].assignments[0]?.person_id,published:IASDPIKnownPreview.plans.get(t.sono.id+':2027-02-01').status};}""")
        self.assertEqual(result,{'conflict':False,'suggested':self.person(),'published':'published'})
    def test_published_weekly_still_blocks_daily_publication_and_suggestion(self):
        self.shared();self.page.evaluate("monthConflictTest.period('weekly')")
        result=self.page.evaluate("""async()=>{const t=monthConflictTest,context=await t.rpc('iasdpi_schedule_rotation_context',{p_department:t.sono.id,p_month:'2027-02-01'});let blocked=false;try{await t.daily();}catch(e){blocked=e.message.includes('Conflito');}return {blocked,conflict:context.people.find(p=>p.person_id===t.person.id).days.find(d=>d.date==='2027-02-03').conflict,written:IASDPIKnownPreview.plans.has(t.sono.id+':2027-02-01')};}""")
        self.assertEqual(result,{'blocked':True,'conflict':True,'written':False})
    def test_monthly_exception_does_not_bypass_membership_or_version_protection(self):
        self.shared();result=self.page.evaluate("""async()=>{const t=monthConflictTest,saved=await t.period('monthly'),r=saved.periods[0];let stale=false,inactive=false;try{await t.rpc('iasdpi_schedule_elder_save',{p_department:t.elder.id,p_status:'draft',p_rows:[{...r,expected_version:0}],p_request_id:crypto.randomUUID()});}catch(e){stale=e.message.includes('mudou');}const row=IASDPIKnownPreviewSeed.catalog.people.find(p=>p.id===t.person.id);row.active=false;try{await t.rpc('iasdpi_schedule_elder_save',{p_department:t.elder.id,p_status:'draft',p_rows:[{...r,expected_version:r.version}],p_request_id:crypto.randomUUID()});}catch(e){inactive=e.message.includes('inativa');}return {stale,inactive,version:[...IASDPIKnownPreview.elderPeriods.values()][0].version};}""")
        self.assertEqual(result,{'stale':True,'inactive':True,'version':1})
    def test_annual_notice_and_history_retained(self):
        before=self.page.evaluate('JSON.stringify({official:IASDPICalendarOfficialSource(),legacy:IASDPIKnownPreview.legacy})');self.elder();self.page.locator('[data-kind=monthly]').click();self.assertIn('Conflitos do Ancião do mês desativados',self.page.locator('main').inner_text());self.assertEqual(self.page.locator('.elder-month-card').count(),12)
        self.assertEqual(before,self.page.evaluate('JSON.stringify({official:IASDPICalendarOfficialSource(),legacy:IASDPIKnownPreview.legacy})'))
