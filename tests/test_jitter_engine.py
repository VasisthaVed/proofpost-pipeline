import pytest
import asyncio
from unittest.mock import patch
from execution.jitter_engine import JitterEngine

@pytest.fixture
def engine():
    return JitterEngine(default_min=45.0, default_max=120.0)

def test_calculate_jitter_range(engine):
    """Should return a value within the specified range."""
    # Test multiple times to ensure randomness stays within bounds
    for _ in range(100):
        delay = engine.calculate_jitter(10, 20)
        assert 10 <= delay <= 20

def test_calculate_jitter_defaults(engine):
    """Should use engine defaults if no range provided."""
    with patch("random.uniform", return_value=50.0) as mock_random:
        delay = engine.calculate_jitter()
        mock_random.assert_called_once_with(45.0, 120.0)
        assert delay == 50.0

def test_calculate_backoff_scaling(engine):
    """Should scale exponentially: 2, 4, 8, 16..."""
    # Disable jitter for deterministic scaling check
    assert engine.calculate_backoff(1, base_delay=2.0, add_jitter=False) == 2.0
    assert engine.calculate_backoff(2, base_delay=2.0, add_jitter=False) == 4.0
    assert engine.calculate_backoff(3, base_delay=2.0, add_jitter=False) == 8.0
    assert engine.calculate_backoff(4, base_delay=2.0, add_jitter=False) == 16.0

def test_calculate_backoff_max_limit(engine):
    """Should respect the max_delay limit."""
    delay = engine.calculate_backoff(10, base_delay=2.0, max_delay=50.0, add_jitter=False)
    assert delay == 50.0

def test_calculate_backoff_zero_attempt(engine):
    """Should return 0 for non-positive attempts."""
    assert engine.calculate_backoff(0) == 0.0
    assert engine.calculate_backoff(-1) == 0.0

@pytest.mark.asyncio
async def test_wait_jitter_calls_sleep(engine):
    """Should call asyncio.sleep with calculated jitter."""
    with patch("random.uniform", return_value=15.0):
        with patch("asyncio.sleep", return_value=None) as mock_sleep:
            await engine.wait_jitter(10, 20)
            mock_sleep.assert_called_once_with(15.0)

@pytest.mark.asyncio
async def test_wait_backoff_calls_sleep(engine):
    """Should call asyncio.sleep with calculated backoff."""
    # Mock calculate_backoff to return 10.0
    with patch.object(JitterEngine, "calculate_backoff", return_value=10.0):
        with patch("asyncio.sleep", return_value=None) as mock_sleep:
            await engine.wait_backoff(1)
            mock_sleep.assert_called_once_with(10.0)
