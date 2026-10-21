"""Validação remota do JWT e da autorização da única igreja, sem cache de papéis."""
import json
import os
import re
import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


class AccessDenied(Exception):
    def __init__(self, message, status):
        super().__init__(message)
        self.status = status


def project_url():
    value = os.environ.get('SUPABASE_URL', '').strip().rstrip('/')
    try:
        parsed = urlsplit(value)
        if (parsed.scheme != 'https' or not parsed.hostname
                or not re.fullmatch(r'[a-z0-9]+\.supabase\.co', parsed.hostname)
                or parsed.netloc != parsed.hostname or parsed.path or parsed.query or parsed.fragment):
            return ''
    except ValueError:
        return ''
    return value


def _get(url, key, token):
    try:
        request = Request(url, headers={'apikey': key, 'Authorization': 'Bearer ' + token})
        with urlopen(request, timeout=10) as response:
            raw = response.read(1048577)
        if len(raw) > 1048576:
            raise ValueError()
        return json.loads(raw)
    except HTTPError as error:
        if error.code == 401:
            raise AccessDenied('Sessão inválida ou expirada. Entre novamente.', 401) from None
        raise AccessDenied('Não foi possível verificar a autorização no Supabase.', 503) from None
    except (URLError, OSError, ValueError):
        raise AccessDenied('Não foi possível verificar a autorização no Supabase.', 503) from None


def authorize(headers):
    authorization = headers.get('Authorization', '')
    if not re.fullmatch(r'Bearer [A-Za-z0-9_.-]{1,8192}', authorization):
        raise AccessDenied('Entre com uma conta autorizada.', 401)
    url, key = project_url(), os.environ.get('SUPABASE_PUBLISHABLE_KEY', '')
    if not url or not key:
        raise AccessDenied('Autenticação do servidor ainda não configurada.', 503)
    token = authorization[7:]
    user = _get(url + '/auth/v1/user', key, token)
    try:
        user_id = str(uuid.UUID(user['id']))
    except (KeyError, TypeError, ValueError, AttributeError):
        raise AccessDenied('Resposta de autenticação inválida.', 401) from None
    if user.get('is_anonymous') is not False:
        raise AccessDenied('Esta conta não possui acesso administrativo.', 403)
    rows = _get(url + '/rest/v1/iasdpi_access?user_id=eq.' + user_id
                + '&select=user_id,role,enabled&limit=1', key, token)
    if (not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict)
            or rows[0].get('user_id') != user_id or rows[0].get('enabled') is not True
            or rows[0].get('role') not in ('admin', 'leader')):
        raise AccessDenied('Conta sem autorização. Solicite acesso à administração.', 403)
    return {'user_id': user_id, 'role': rows[0]['role']}
