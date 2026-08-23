"""add mindmap_json to folders

Revision ID: b7c8d9e0f1a2
Revises: e6f1d295d744
Create Date: 2026-08-23 09:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, Sequence[str], None] = 'e6f1d295d744'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('folders', sa.Column('mindmap_json', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('folders', 'mindmap_json')
