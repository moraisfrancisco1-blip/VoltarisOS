import pytest

from backend import security


@pytest.fixture(autouse=True)
def _session_store_follows_the_test_database(request, monkeypatch):
    """Login sessions are checked through security.engine, but most REST tests run
    against a private in-memory database injected via get_db. Point the session
    check at that same database, so a session created by a test login is the one
    the next request looks up."""
    for name in ("db_session", "db"):
        if name in request.fixturenames:
            session = request.getfixturevalue(name)
            if hasattr(session, "get_bind"):
                monkeypatch.setattr(security, "engine", session.get_bind())
            break
    yield
