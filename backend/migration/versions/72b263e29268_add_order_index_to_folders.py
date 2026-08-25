"""add order_index to folders

Revision ID: 72b263e29268
Revises: b7c8d9e0f1a2
Create Date: 2026-08-24 16:57:23.383428

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '72b263e29268'
down_revision: Union[str, Sequence[str], None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add missing hierarchy fields to folders table."""
    op.add_column('folders', sa.Column('order_index', sa.Integer(), nullable=False, server_default="0"))
    op.add_column('folders', sa.Column('parent_id', sa.String(255), nullable=True))
    op.add_column('folders', sa.Column('depth', sa.Integer(), nullable=False, server_default="0"))
    op.add_column('folders', sa.Column('mindmap_json', sa.Text(), nullable=True))
    
    # Create parent_id index and self-referencing foreign key if needed
    op.create_index(op.f('ix_folders_parent_id'), 'folders', ['parent_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_folders_parent_id'), table_name='folders')
    op.drop_column('folders', 'mindmap_json')
    op.drop_column('folders', 'depth')
    op.drop_column('folders', 'parent_id')
    op.drop_column('folders', 'order_index')