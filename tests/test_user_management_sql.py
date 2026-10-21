"""PostgreSQL REAL isolado em Docker, sem conexão com Supabase.

Defina IASDPI_PG_TEST_CONTAINER para um container postgres com --network none.
Cada teste cria e remove exclusivamente um banco novo iasdpi_test_<uuid>.
"""
import json
import os
from pathlib import Path
import subprocess
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = os.environ.get('IASDPI_PG_TEST_CONTAINER')
A = '11111111-1111-4111-8111-111111111111'
B = '22222222-2222-4222-8222-222222222222'
L = '33333333-3333-4333-8333-333333333333'
U = '44444444-4444-4444-8444-444444444444'
V = '55555555-5555-4555-8555-555555555555'
N = '66666666-6666-4666-8666-666666666666'
X = '77777777-7777-4777-8777-777777777777'


@unittest.skipUnless(CONTAINER, 'PostgreSQL local isolado não solicitado')
class UserManagementSQLTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.env = dict(os.environ)
        for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
            cls.env.pop(key, None)
        cls.docker = ['docker', '--host=unix:///var/run/docker.sock']
        mode = subprocess.check_output(cls.docker + ['inspect', '--format', '{{.HostConfig.NetworkMode}}', CONTAINER], env=cls.env, text=True).strip()
        if mode != 'none':
            raise RuntimeError('Recusado: testes exigem container sem rede.')
        cls.exec = cls.docker + ['exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres']
        subprocess.run(cls.exec + ['-d', 'postgres'], input="do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end; $$;", text=True, capture_output=True, env=cls.env, check=True)

    def setUp(self):
        self.db = 'iasdpi_test_' + uuid.uuid4().hex
        self.sql('create database ' + self.db, database='postgres')
        self.addCleanup(self.sql, 'drop database ' + self.db + ' with (force)', database='postgres')
        self.sql('''
          create schema auth;
          create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,is_anonymous boolean default false);
          create function auth.uid() returns uuid language sql stable as $$
            select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
          $$;
          create function auth.jwt() returns jsonb language sql stable as $$
            select nullif(current_setting('request.jwt.claims',true),'')::jsonb;
          $$;
          grant usage on schema auth to anon,authenticated;
        ''')
        self.sql((ROOT / 'database/001_single_church_access.sql').read_text())
        for identifier, name in [(A, 'admin'), (B, 'admin2'), (L, 'leader'), (U, 'new'), (V, 'other'), (N, 'unconfirmed'), (X, 'anonymous')]:
            self.sql("insert into auth.users values ('%s','%s@example.invalid',%s,%s)" %
                     (identifier, name, 'null' if identifier == N else 'now()', 'true' if identifier == X else 'false'))
        self.sql("insert into public.iasdpi_access(user_id,role) values ('%s','admin'),('%s','leader')" % (A, L))
        self.sql("insert into public.culto_archives(owner_id,digest,payload) values ('%s',repeat('a',64),'{\"format\":\"IASDPI-backup\",\"version\":1,\"programs\":[]}')" % A)
        self.before_archive = self.sql('select row_to_json(a) from public.culto_archives a')
        self.before_access = self.sql('select row_to_json(a) from public.iasdpi_access a order by user_id')
        self.before_oids = self.sql("select oid from pg_class where oid in ('public.iasdpi_access'::regclass,'public.iasdpi_templates'::regclass,'public.culto_archives'::regclass) order by oid")
        self.sql((ROOT / 'database/002_user_management.sql').read_text())

    def command(self, source, actor=None, anonymous=False):
        if actor or anonymous:
            claims = json.dumps({'sub': actor, 'role': 'anon' if anonymous else 'authenticated', 'is_anonymous': False})
            source = "begin; set local role %s; set local \"request.jwt.claims\"='%s'; %s; commit;" % ('anon' if anonymous else 'authenticated', claims, source)
        return source

    def sql(self, source, actor=None, anonymous=False, database=None, fail=False):
        result = subprocess.run(self.exec + ['-d', database or self.db], input=self.command(source, actor, anonymous), text=True, capture_output=True, env=self.env)
        if fail:
            self.assertNotEqual(result.returncode, 0, 'Operação indevida foi aceita')
        elif result.returncode:
            self.fail(result.stderr)
        return result.stdout.strip()

    def invite(self):
        return json.loads(self.sql("select row_to_json(i) from public.iasdpi_create_invite('new@example.invalid') i", actor=A))

    def test_admin_lists_only_authorized_accounts(self):
        result = self.sql('select email from public.iasdpi_list_users()', actor=A)
        self.assertIn('leader@example.invalid', result)
        self.assertNotIn('new@example.invalid', result)

    def test_anon_leader_and_unapproved_cannot_call_admin_rpcs(self):
        operations = ["select * from public.iasdpi_list_users()", "select * from public.iasdpi_find_account('new@example.invalid')",
                      "select public.iasdpi_set_access('%s','admin',true)" % U,
                      "select * from public.iasdpi_create_invite('new@example.invalid')",
                      'select * from public.iasdpi_list_invites()', "select public.iasdpi_revoke_invite(gen_random_uuid())"]
        for operation in operations:
            self.sql(operation, anonymous=True, fail=True)
            for actor in (L, U):
                self.sql(operation, actor=actor, fail=True)

    def test_direct_grants_and_private_helpers_denied(self):
        for actor in (A, L, U):
            for operation in ("update public.iasdpi_access set role='admin' where user_id='%s'" % L,
                              'select * from iasdpi_admin_private.invitations',
                              'select iasdpi_admin_private.require_admin()',
                              "delete from public.iasdpi_access where user_id='%s'" % A):
                self.sql(operation, actor=actor, fail=True)

    def test_admin_can_authorize_promote_and_revoke(self):
        self.sql("select public.iasdpi_set_access('%s','leader',true)" % U, actor=A)
        self.sql("select public.iasdpi_set_access('%s','admin',true)" % U, actor=A)
        self.assertEqual(self.sql("select role from public.iasdpi_access where user_id='%s'" % U), 'admin')
        self.sql("select public.iasdpi_set_access('%s','admin',false)" % U, actor=A)
        self.sql('select * from public.iasdpi_list_users()', actor=U, fail=True)
        self.assertEqual(self.sql("select count(*) from iasdpi_admin_private.audit where action='set_access'"), '3')

    def test_invalid_role_unconfirmed_and_anonymous_rejected(self):
        for target, role in [(U, 'owner'), (N, 'leader'), (X, 'leader')]:
            self.sql("select public.iasdpi_set_access('%s','%s',true)" % (target, role), actor=A, fail=True)

    def test_no_bootstrap_or_self_approval(self):
        self.sql('delete from public.iasdpi_access')
        for actor in (A, U):
            self.sql("select public.iasdpi_set_access('%s','admin',true)" % actor, actor=actor, fail=True)

    def test_last_admin_cannot_be_revoked_or_demoted(self):
        self.sql("select public.iasdpi_set_access('%s','admin',false)" % A, actor=A, fail=True)
        self.sql("select public.iasdpi_set_access('%s','leader',true)" % A, actor=A, fail=True)

    def test_concurrent_admin_removals_are_serialized(self):
        self.sql("insert into public.iasdpi_access(user_id,role) values ('%s','admin')" % B)
        first = self.command("select public.iasdpi_set_access('%s','leader',true); select pg_sleep(0.8)" % A, A)
        one = subprocess.Popen(self.exec + ['-d', self.db], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=self.env)
        one.stdin.write(first)
        one.stdin.close()
        # Esperar pelo bloqueio real, sem inferir concorrência por um sleep no cliente.
        for _ in range(100):
            if self.sql("select count(*) from pg_stat_activity where datname=current_database() and wait_event='PgSleep'") == '1':
                break
        else:
            self.fail('Primeira transação não entrou no intervalo controlado')
        self.sql("select public.iasdpi_set_access('%s','leader',true)" % B, actor=B, fail=True)
        one.wait(timeout=10)
        self.assertEqual(one.returncode, 0, one.stderr.read())
        one.stdout.close()
        one.stderr.close()
        self.assertEqual(self.sql("select count(*) from public.iasdpi_access where role='admin' and enabled"), '1')

    def test_waiting_revoked_actor_cannot_continue(self):
        self.sql("insert into public.iasdpi_access(user_id,role) values ('%s','admin')" % B)
        source = self.command("select public.iasdpi_set_access('%s','admin',false); select pg_sleep(0.8)" % B, A)
        first = subprocess.Popen(self.exec + ['-d', self.db], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=self.env)
        first.stdin.write(source)
        first.stdin.close()
        for _ in range(100):
            if self.sql("select count(*) from pg_stat_activity where datname=current_database() and wait_event='PgSleep'") == '1':
                break
        self.sql("select public.iasdpi_set_access('%s','admin',true)" % U, actor=B, fail=True)
        first.wait(timeout=10)
        self.assertEqual(first.returncode, 0, first.stderr.read())
        first.stdout.close()
        first.stderr.close()
        self.assertEqual(self.sql("select count(*) from public.iasdpi_access where user_id='%s'" % U), '0')

    def test_invite_is_bound_to_email_single_use_and_leader_only(self):
        invite = self.invite()
        self.sql("select public.iasdpi_accept_invite('%s')" % invite['token'], actor=V, fail=True)
        self.sql("select public.iasdpi_accept_invite('%s')" % invite['token'], actor=U)
        self.assertEqual(self.sql("select role from public.iasdpi_access where user_id='%s'" % U), 'leader')
        self.sql("select public.iasdpi_accept_invite('%s')" % invite['token'], actor=U, fail=True)
        self.assertNotIn(invite['token'], self.sql('select token_hash from iasdpi_admin_private.invitations'))

    def test_invite_revocation_expiry_and_creator_revocation(self):
        for reason in ('revoked', 'expired', 'creator'):
            invite = self.invite()
            if reason == 'revoked':
                self.sql("select public.iasdpi_revoke_invite('%s')" % invite['id'], actor=A)
            elif reason == 'expired':
                self.sql("update iasdpi_admin_private.invitations set created_at=now()-interval '3 days',expires_at=now()-interval '1 day' where id='%s'" % invite['id'])
            else:
                self.sql("update public.iasdpi_access set enabled=false where user_id='%s'" % A)
            self.sql("select public.iasdpi_accept_invite('%s')" % invite['token'], actor=U, fail=True)

    def test_invite_cannot_reactivate_revoked_user(self):
        invite = self.invite()
        self.sql("insert into public.iasdpi_access(user_id,role,enabled) values ('%s','leader',false)" % U)
        self.sql("select public.iasdpi_accept_invite('%s')" % invite['token'], actor=U, fail=True)

    def test_anonymous_auth_account_and_unconfirmed_cannot_accept(self):
        invite = self.invite()
        for actor in (N, X):
            self.sql("select public.iasdpi_accept_invite('%s')" % invite['token'], actor=actor, fail=True)

    def test_invites_do_not_leak_tokens(self):
        invite = self.invite()
        self.assertNotIn(invite['token'], self.sql('select row_to_json(i) from public.iasdpi_list_invites() i', actor=A))
        self.assertNotIn(invite['token'], self.sql('select details::text from iasdpi_admin_private.audit'))

    def test_existing_records_and_archives_remain_immutable(self):
        self.assertEqual(self.sql('select count(*) from public.iasdpi_templates'), '1')
        for actor in (A, L):
            self.assertEqual(self.sql('select count(*) from public.culto_archives', actor=actor), '1')
            self.sql('delete from public.culto_archives', actor=actor, fail=True)
        self.assertEqual(self.sql('select count(*) from public.culto_archives'), '1')

    def test_migration_preserves_tables_authorizations_and_archive(self):
        self.assertEqual(self.sql('select row_to_json(a) from public.culto_archives a'), self.before_archive)
        self.assertEqual(self.sql('select row_to_json(a) from public.iasdpi_access a order by user_id'), self.before_access)
        self.assertEqual(self.sql("select oid from pg_class where oid in ('public.iasdpi_access'::regclass,'public.iasdpi_templates'::regclass,'public.culto_archives'::regclass) order by oid"), self.before_oids)


if __name__ == '__main__':
    unittest.main()
