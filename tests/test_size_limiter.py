import pytest
from ingestion.size_limiter import check_size

def test_check_size_under_limit():
    """Should return True for payload smaller than the limit."""
    payload = b"hello world"
    assert check_size(payload, max_kb=1) is True

def test_check_size_at_limit():
    """Should return True for payload exactly at the limit."""
    payload = b"a" * 1024
    assert check_size(payload, max_kb=1) is True

def test_check_size_over_limit():
    """Should return False for payload over the limit."""
    payload = b"a" * 1025
    assert check_size(payload, max_kb=1) is False

def test_check_size_null_payload():
    """Should return False for None payload."""
    assert check_size(None, max_kb=1) is False

def test_check_size_default_limit():
    """Should respect the default 512KB limit."""
    # 512 KB
    payload = b"a" * (512 * 1024)
    assert check_size(payload) is True
    
    # 512 KB + 1 byte
    over_payload = b"a" * (512 * 1024 + 1)
    assert check_size(over_payload) is False
