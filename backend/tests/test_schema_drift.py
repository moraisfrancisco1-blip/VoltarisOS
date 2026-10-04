"""A model column nobody migrated must be reported before it becomes a 500."""
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from backend import models, schema_drift
from backend.database import Base


def _engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    return engine


def test_a_database_built_from_the_models_has_no_drift():
    drift = schema_drift.find_drift(_engine())
    assert drift == {"missing_tables": [], "missing_columns": {}}
    assert schema_drift.drift_status(_engine())["status"] == "healthy"


def test_a_missing_table_is_reported():
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE user_sessions"))
    status = schema_drift.drift_status(engine)
    assert status["status"] == "drift" and status["missing_tables"] == ["user_sessions"]


def test_a_missing_column_is_reported_by_name():
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users DROP COLUMN phone"))
    status = schema_drift.drift_status(engine)
    assert status["status"] == "drift" and status["missing_columns"] == {"users": ["phone"]}


def test_extra_columns_in_the_database_are_not_drift():
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN legacy_flag INTEGER"))
    assert schema_drift.find_drift(engine) == {"missing_tables": [], "missing_columns": {}}


def test_an_unreadable_database_is_unknown_not_a_crash():
    class Broken:
        pass

    assert schema_drift.drift_status(Broken())["status"] == "unknown"
