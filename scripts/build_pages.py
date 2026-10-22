"""Gera o Pages atual com persistência operacional Supabase (requer migração 003)."""
import argparse
from pathlib import Path

from build_homologation import build, ROOT

SITE_URL = 'https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/pages')
    parser.add_argument('--agenda-data', type=Path)
    parser.add_argument('--operational', action='store_true', help='Compatibilidade: Supabase operacional já é o padrão deste gerador')
    args = parser.parse_args()
    build(args.output, SITE_URL, args.agenda_data, preserve_local=True, operational=True)
    print('Pages preparado:', args.output)
    print('Pacote Supabase operacional preparado; não publicado.')
