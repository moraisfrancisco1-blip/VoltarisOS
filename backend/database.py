import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Railway injects DATABASE_URL automatically when you add a PostgreSQL service.
# Locally falls back to SQLite so dev still works without any setup.
_raw_url = os.environ.get("DATABASE_URL", "sqlite:///./energy.db")

# Railway gives postgres:// but SQLAlchemy 1.4+ requires postgresql://
DATABASE_URL = _raw_url.replace("postgres://", "postgresql://", 1)

# SQLAlchemy 2.1 made psycopg (v3) the default driver for plain postgresql://
# URLs; this project ships psycopg2-binary, so pin the driver explicitly.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,      # auto-reconnect if connection drops
        pool_size=5,
        max_overflow=10,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
