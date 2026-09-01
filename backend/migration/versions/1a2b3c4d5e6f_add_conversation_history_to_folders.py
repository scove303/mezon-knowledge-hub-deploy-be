"""add conversation_history to folders

Revision ID: 1a2b3c4d5e6f
Revises: fab900cf5fdc
Create Date: 2026-08-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, Sequence[str], None] = 'fab900cf5fdc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('folders', sa.Column('conversation_history', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('folders', 'conversation_history')