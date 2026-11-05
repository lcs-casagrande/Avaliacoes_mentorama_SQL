"""Compara metadados G10.1 offline. Não abre conexões nem executa SQL recebido."""
import argparse
import hashlib
import json
import re
from pathlib import Path


def canonical(value):
    if isinstance(value, dict):
        return {key: canonical(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        return sorted((canonical(item) for item in value), key=lambda item: json.dumps(item, sort_keys=True))
    return value


def signature(function):
    return f"{function['schema']}.{function['name']}({function['arguments']})"


def differences(expected, observed, path=''):
    if isinstance(expected, dict) and isinstance(observed, dict):
        result = []
        for key in sorted(expected.keys() | observed.keys()):
            child = f'{path}/{key}'
            if key not in expected or key not in observed:
                result.append({'path': child, 'expected': expected.get(key), 'observed': observed.get(key)})
            else:
                result.extend(differences(expected[key], observed[key], child))
        return result
    if canonical(expected) == canonical(observed):
        return []
    return [{'path': path, 'expected': expected, 'observed': observed}]


def named_section(expected, observed, identity):
    left = {identity(row): row for row in expected}
    right = {identity(row): row for row in observed}
    if len(left) != len(expected) or len(right) != len(observed):
        raise ValueError('Identificadores duplicados no inventário.')
    return {
        'missing': sorted(left.keys() - right.keys()),
        'extra': sorted(right.keys() - left.keys()),
        'changed': {key: differences(left[key], right[key]) for key in sorted(left.keys() & right.keys())
                    if differences(left[key], right[key])},
    }


def validate(document):
    sections = ('roles', 'markers', 'schemas', 'functions', 'relations', 'extensions',
                'dependencies', 'role_memberships', 'default_privileges', 'publications')
    if document.get('format') != 'IASDPI_G10_1_SCHEMA_INVENTORY' or document.get('version') != 1:
        raise ValueError('Formato de inventário G10.1 inválido.')
    if any(not isinstance(document.get(name), list) for name in sections):
        raise ValueError('Inventário incompleto; não concluir compatibilidade.')
    return document


def normalized_dependency(row):
    # Somente nomes gerados pelo servidor que contêm OIDs, nunca nomes de negócio.
    return {key: re.sub(r'RI_ConstraintTrigger_([ac])_\d+', r'RI_ConstraintTrigger_\1_<oid>',
                       re.sub(r'pg_toast_\d+', 'pg_toast_<oid>', value)) for key, value in row.items()}


def compare(expected, observed, definitions):
    validate(expected)
    validate(observed)
    relations = named_section(expected['relations'], observed['relations'], lambda row: row['name'])
    functions = named_section(expected['functions'], observed['functions'], signature)
    sources = {signature(row): row for row in definitions}
    function_proofs = []
    for row in observed['functions']:
        key = signature(row)
        source = sources.get(key)
        status = 'unresolved'
        local_hash = crlf_hash = None
        if source:
            text, body = source['definition'], source['source']
            # Requer deparse local com um único corpo delimitado e prova por hash
            # da definição INTEIRA; não normaliza arbitrariamente a entrada real.
            if text.count('$function$') != 2 or text.split('$function$')[1] != body:
                raise ValueError('Delimitação de corpo local inesperada: ' + key)
            prefix, _, suffix = text.split('$function$')
            candidate = '$function$'.join((prefix, body.replace('\n', '\r\n'), suffix))
            local_hash = hashlib.md5(text.encode()).hexdigest()
            crlf_hash = hashlib.md5(candidate.encode()).hexdigest()
            if row['definition_md5'] == local_hash:
                status = 'exact'
            elif row['definition_md5'] == crlf_hash:
                status = 'exact_full_definition_with_body_crlf'
        function_proofs.append({'signature': key, 'status': status,
                                'expected_md5': local_hash, 'body_crlf_md5': crlf_hash,
                                'observed_md5': row['definition_md5']})

    sections = {}
    for name in ('schemas', 'roles', 'extensions', 'publications'):
        sections[name] = named_section(expected[name], observed[name], lambda row: row['name'])
    dependency_diff = differences([normalized_dependency(row) for row in expected['dependencies']],
                                  [normalized_dependency(row) for row in observed['dependencies']])
    # Ordem física das colunas é registrada separadamente; arrays de ACL não têm ordem semântica.
    expected_relations = {row['name']: row for row in expected['relations']}
    order_changes = [row['name'] for row in observed['relations'] if row['name'] in expected_relations
                     and [col['name'] for col in row['columns']] !=
                     [col['name'] for col in expected_relations[row['name']]['columns']]]
    unresolved = [row['signature'] for row in function_proofs if row['status'] == 'unresolved']
    counts = {name: len(observed[name]) for name in ('relations', 'functions', 'dependencies', 'default_privileges')}
    counts.update({name: sum(len(row[name]) for row in observed['relations'])
                   for name in ('columns', 'constraints', 'indexes', 'policies', 'triggers')})
    return {
        'format': 'IASDPI_G10_5_OFFLINE_COMPARISON', 'version': 1,
        'captured_at': observed.get('captured_at'), 'postgresql_version_num': observed.get('postgresql_version_num'),
        'expected_postgresql_version_num': expected.get('postgresql_version_num'),
        'counts': counts, 'relations': relations, 'column_order_changed': order_changes,
        'functions': functions, 'function_definition_proofs': function_proofs,
        'unresolved_function_definitions': unresolved, **sections,
        'dependencies': {'observed_count': len(observed['dependencies']),
                         'expected_count': len(expected['dependencies']),
                         'equal_after_system_oid_name_normalization': not dependency_diff,
                         'differences': dependency_diff},
        'role_membership_differences': differences(expected['role_memberships'], observed['role_memberships']),
        'default_privilege_differences': differences(expected['default_privileges'], observed['default_privileges']),
        'auth_primitives': observed['auth_primitives'], 'migration_markers': observed['markers'],
        'migration_ledger': observed['migration_ledger'],
        'remote_contact_performed': False, 'business_rows_compared': False,
        'provider_auth_settings_verified': False,
        'fully_identical': not unresolved and not relations['changed'] and not relations['missing']
                           and not relations['extra'] and not functions['changed']
                           and not functions['missing'] and not functions['extra']
                           and not order_changes and not dependency_diff
                           and all(not any(section.values()) for section in sections.values())
                           and expected['role_memberships'] == observed['role_memberships']
                           and expected['default_privileges'] == observed['default_privileges'],
        'installation_authorized': False,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('expected', 'observed', 'definitions', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    data = compare(*(json.loads(path.read_text(encoding='utf-8-sig'))
                     for path in (args.expected, args.observed, args.definitions)))
    data['input_sha256'] = {name: hashlib.sha256(getattr(args, name).read_bytes()).hexdigest()
                            for name in ('expected', 'observed', 'definitions')}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(args.output)
