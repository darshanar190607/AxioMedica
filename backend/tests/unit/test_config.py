"""
Unit tests for configuration loading and CORS parsing.
"""
from app.core.config import Settings


def test_cors_origins_parsing_comma_separated():
    s = Settings(CORS_ORIGINS="http://localhost:8081, http://192.168.1.50:8081")
    assert "http://localhost:8081" in s.CORS_ORIGINS
    assert "http://192.168.1.50:8081" in s.CORS_ORIGINS


def test_cors_origins_parsing_json_array():
    s = Settings(CORS_ORIGINS='["http://localhost:3000", "http://localhost:8081"]')
    assert isinstance(s.CORS_ORIGINS, list)
    assert len(s.CORS_ORIGINS) == 2


def test_default_config_values():
    s = Settings()
    assert s.ACCESS_TTL_MIN == 60
    assert s.REFRESH_TTL_DAYS == 30
    assert s.API_V1_STR == "/api/v1"
