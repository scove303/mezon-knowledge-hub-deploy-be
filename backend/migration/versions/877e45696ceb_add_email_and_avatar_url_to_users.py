"""add email and avatar_url to users

Revision ID: 877e45696ceb
Revises: 
Create Date: 2026-07-29 22:35:45.499621

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '877e45696ceb'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add email and avatar_url to users table."""
    # Add email and avatar_url columns to users table
    op.add_column('users', sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    
    # Ensure email values are unique
    op.create_unique_constraint('uq_users_email', 'users', ['email'])


def downgrade() -> None:
    """Downgrade schema - Remove email and avatar_url from users table."""
    op.drop_constraint('uq_users_email', 'users', type_='unique')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'email')