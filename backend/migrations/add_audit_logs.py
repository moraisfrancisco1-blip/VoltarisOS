"""
Migration script: Add audit_logs table.

This script creates the audit_logs table for tracking critical actions.
Run this script once to create the table in your database.

Usage:
    python -m backend.migrations.add_audit_logs

The table is APPEND-ONLY — no UPDATE or DELETE operations should be performed.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine, Base
from backend.models import AuditLog


def migrate():
    """Create the audit_logs table if it doesn't exist."""
    print("Creating audit_logs table...")
    
    # Create only the audit_logs table (not all tables)
    AuditLog.__table__.create(bind=engine, checkfirst=True)
    
    print("✓ audit_logs table created successfully")
    print(f"  Columns: id, tenant_id, user_id, user_email, action, target_resource, target_id, ip_address, user_agent, details, timestamp")
    print(f"  Indexes: ix_audit_logs_tenant_timestamp, ix_audit_logs_user_timestamp")
    print("\nThe table is APPEND-ONLY. Do not perform UPDATE or DELETE operations.")


if __name__ == "__main__":
    migrate()