import pytest
from ingestion.payload_sanitizer import sanitize_payload

def test_sanitize_html_tags():
    """Should strip HTML tags from strings."""
    payload = {"content": "<script>alert('xss')</script>Hello <b>World</b>"}
    expected = {"content": "alert('xss')Hello World"}
    assert sanitize_payload(payload) == expected

def test_sanitize_template_syntax():
    """Should neutralize {{ }} and ${ } syntax."""
    payload = {
        "jinja": "Hello {{ user.name }}",
        "shell": "Echo ${USER}"
    }
    expected = {
        "jinja": "Hello {[ user.name ]}",
        "shell": "Echo $[USER}" # Note: my implementation for ${ only replaces the opening
    }
    # Let me re-check my implementation for ${ in payload_sanitizer.py
    # clean_value.replace('${', '$[')
    # Yes, it replaces ${ with $[
    assert sanitize_payload(payload) == expected

def test_sanitize_recursive_list():
    """Should sanitize strings inside lists."""
    payload = ["<p>One</p>", {"inner": "{{two}}"}]
    expected = ["One", {"inner": "{[two]}"}]
    assert sanitize_payload(payload) == expected

def test_sanitize_primitives():
    """Should leave non-string primitives alone."""
    payload = {"id": 123, "active": True, "score": 9.5, "null": None}
    assert sanitize_payload(payload) == payload

def test_complex_nesting():
    """Should handle complex nested structures."""
    payload = {
        "data": [
            {"text": "<b>Bold</b>"},
            ["{{template}}", "${env}"]
        ]
    }
    expected = {
        "data": [
            {"text": "Bold"},
            ["{[template]}", "$[env}"]
        ]
    }
    assert sanitize_payload(payload) == expected
