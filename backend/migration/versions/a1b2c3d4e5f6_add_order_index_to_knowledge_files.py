"""add order_index to knowledge_files table

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2026-08-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'knowledge_files',
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0')
    )
    op.execute(
        """
        UPDATE knowledge_files kf
        JOIN (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY folder_id ORDER BY created_at, id) - 1 AS rn
            FROM knowledge_files
        ) x ON kf.id = x.id
        SET kf.order_index = x.rn
        """
    )


def downgrade() -> None:
    op.drop_column('knowledge_files', 'order_index')
