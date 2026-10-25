"""Gera o Pages atual com persistência operacional Supabase (requer migrações 003 e 004)."""
import argparse
from pathlib import Path

from build_homologation import build, build_rollback, validate_package, ROOT

SITE_URL = 'https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/pages')
    parser.add_argument('--agenda-data', type=Path)
    parser.add_argument('--previous-site', type=Path, help='Pacote publicado completo: preserva aliases e recursos para atualização e rollback')
    action = parser.add_mutually_exclusive_group()
    action.add_argument('--rollback-site', type=Path, help='Prepara rollback local; exige --previous-site com a versão atual completa')
    action.add_argument('--validate-site', type=Path, help='Somente valida manifesto, hashes e dependências de um pacote, sem escrever arquivos')
    parser.add_argument('--operational', action='store_true', help='Compatibilidade: Supabase operacional já é o padrão deste gerador')
    args = parser.parse_args()
    if args.validate_site:
        try:
            manifest = validate_package(args.validate_site)
        except ValueError as error:
            parser.exit(1, str(error) + '\n')
        parser.exit(0, 'Pacote validado: ' + str(len(manifest['files'])) + ' arquivos e manifesto.\n')
    if args.rollback_site:
        if not args.previous_site:
            parser.error('--rollback-site exige --previous-site')
        build_rollback(args.output, args.rollback_site, args.previous_site)
    else:
        build(args.output, SITE_URL, args.agenda_data, preserve_local=True, operational=True, previous_site=args.previous_site)
    print('Pages preparado:', args.output)
    print('Pacote Supabase operacional preparado; não publicado.')
    if not args.previous_site:
        print('Para publicar sobre o site existente, regenere com --previous-site; compatibilidade legada ainda não conferida.')
