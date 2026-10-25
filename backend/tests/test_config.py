import pytest
from pydantic import ValidationError

from app.config import Settings

DB = "postgresql+psycopg://u:p@localhost/db_test"


def test_placeholder_or_short_secret_key_is_rejected():
    with pytest.raises(ValidationError):
        Settings(database_url=DB, secret_key="CHANGE_ME", _env_file=None)


def test_non_postgres_database_url_is_rejected():
    with pytest.raises(ValidationError):
        Settings(database_url="sqlite:///:memory:", secret_key="x" * 40, _env_file=None)


def test_cors_origins_are_parsed():
    settings = Settings(database_url=DB, secret_key="x" * 40, cors_origins="http://a.com, http://b.com", _env_file=None)
    assert settings.cors_origin_list == ["http://a.com", "http://b.com"]
