"""add_mezon_id_to_user_table

Revision ID: 7a813ea38146
Revises: a1b2c3d4e5f6
Create Date: 2026-08-13 21:04:03.531692

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '7a813ea38146'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('mezon_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_mezon_id'), 'users', ['mezon_id'], unique=True)

def downgrade() -> None:
    op.drop_index(op.f('ix_users_mezon_id'), table_name='users')
    op.drop_column('users', 'mezon_id')
    # ### end Alembic commands ###
