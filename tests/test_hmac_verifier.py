import pytest
import hmac
import hashlib
import time
from ingestion.hmac_verifier import verify_signature

@pytest.fixture
def secret():
    return "test_secret_key"

@pytest.fixture
def payload():
    return b'{"event": "push", "ref": "refs/heads/master"}'

def calculate_signature(payload, secret):
    return "sha256=" + hmac.new(
        secret.encode("utf-8"), 
        payload, 
        hashlib.sha256
    ).hexdigest()

def test_verify_signature_success(payload, secret):
    """Should return True for valid signature and current timestamp."""
    sig = calculate_signature(payload, secret)
    now = time.time()
    assert verify_signature(payload, sig, secret, now) is True

def test_verify_signature_fail_invalid_sig(payload, secret):
    """Should return False for invalid signature."""
    sig = "sha256=invalidhash"
    now = time.time()
    assert verify_signature(payload, sig, secret, now) is False

def test_verify_signature_fail_expired(payload, secret):
    """Should return False for timestamp older than 5 minutes."""
    sig = calculate_signature(payload, secret)
    # 6 minutes ago
    old_time = time.time() - 360
    assert verify_signature(payload, sig, secret, old_time) is False

def test_verify_signature_fail_future(payload, secret):
    """Should return False for timestamp too far in the future."""
    sig = calculate_signature(payload, secret)
    # 6 minutes in future
    future_time = time.time() + 360
    assert verify_signature(payload, sig, secret, future_time) is False

def test_verify_signature_missing_header(payload, secret):
    """Should return False if signature header is empty."""
    assert verify_signature(payload, "", secret) is False

def test_verify_signature_no_timestamp(payload, secret):
    """Should return True if signature is valid even if timestamp is None (skips age check)."""
    sig = calculate_signature(payload, secret)
    assert verify_signature(payload, sig, secret, None) is True

def test_verify_signature_invalid_format(payload, secret):
    """Should return False if signature format doesn't start with sha256=."""
    sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    assert verify_signature(payload, sig, secret) is False
