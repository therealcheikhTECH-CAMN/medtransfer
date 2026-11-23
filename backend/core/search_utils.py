import re
import unicodedata
from django.db.models import Q

ACCENT_MAP = {
    'a': '[aàáâãäåAÀÁÂÃÄÅ]',
    'e': '[eéèêëEÉÈÊË]',
    'i': '[iíìîïIÍÌÎÏ]',
    'o': '[oóòôõöOÓÒÔÕÖ]',
    'u': '[uúùûüUÚÙÛÜ]',
    'c': '[cçCÇ]',
    'n': '[nñNÑ]',
    'y': '[yýÿYÝŸ]',
}


def normalize_text_for_search(text: str) -> str:
    """
    Supprime les diacritiques (accents) et convertit en minuscules.
    """
    if not text:
        return ''
    nfkd = unicodedata.normalize('NFKD', str(text))
    return ''.join(c for c in nfkd if not unicodedata.combining(c)).strip().lower()


def build_accent_regex(token: str) -> str:
    """
    Transforme un mot-clé comme 'hopital' ou 'hôpital' en pattern regex
    capable de matcher indifféremment les formes accentuées et non accentuées.
    """
    if not token:
        return ''
    base = normalize_text_for_search(token)
    pattern_parts = []
    for char in base:
        if char in ACCENT_MAP:
            pattern_parts.append(ACCENT_MAP[char])
        elif re.escape(char) != char:
            pattern_parts.append(re.escape(char))
        else:
            pattern_parts.append(char)
    return ''.join(pattern_parts)


def build_multi_token_q(query: str, fields: list[str]) -> Q:
    """
    Construit un objet Django Q multi-mots (ET logique entre les tokens, OU logique entre les champs).
    Chaque mot-clé est insensible à la casse et tolérant aux accents via regex.
    """
    if not query or not query.strip():
        return Q()

    tokens = query.strip().split()
    combined_q = Q()

    for token in tokens:
        regex_pattern = build_accent_regex(token)
        token_q = Q()
        for field in fields:
            token_q |= Q(**{f"{field}__iregex": regex_pattern})
        combined_q &= token_q

    return combined_q
