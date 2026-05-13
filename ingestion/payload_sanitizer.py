"""Payload sanitization logic.

This module cleans and validates incoming webhook payloads,
removing any potentially dangerous content or malformed data.
"""

import re
import structlog
from typing import Any, Dict, List, Union

logger = structlog.get_logger()

# Regex to match HTML tags
HTML_TAG_RE = re.compile(r'<[^>]+>')

# Regex to match template syntax: {{ }} and ${ }
TEMPLATE_SYNTAX_RE = re.compile(r'\{\{.*?\}\}|\$\{.*?\}')

def _sanitize_string(value: str) -> str:
    """Internal helper to clean a single string.
    
    1. Strips HTML tags
    2. Neutralizes template syntax by escaping brackets
    """
    if not value:
        return value
        
    # Remove HTML tags
    clean_value = HTML_TAG_RE.sub('', value)
    
    # Neutralize template syntax (replace { with [ and } with ] for double braces)
    # We do a simple replacement for {{ and }} and ${ } to prevent downstream injection
    clean_value = clean_value.replace('{{', '{[').replace('}}', ']}')
    clean_value = clean_value.replace('${', '$[')
    
    return clean_value

def sanitize_payload(payload: Any) -> Any:
    """Recursively sanitizes a payload (dict, list, or primitive).
    
    Args:
        payload: The data structure to sanitize.
        
    Returns:
        The sanitized data structure.
    """
    if isinstance(payload, dict):
        return {k: sanitize_payload(v) for k, v in payload.items()}
    elif isinstance(payload, list):
        return [sanitize_payload(i) for i in payload]
    elif isinstance(payload, str):
        return _sanitize_string(payload)
    else:
        return payload