"""add prompt_embedding to folders table

Revision ID: 3185770ec2a5
Revises: 877e45696ceb
Create Date: 2026-07-31 19:45:43.824355

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3185770ec2a5'
down_revision: Union[str, Sequence[str], None] = '877e45696ceb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add prompt_embedding column as JSON type
    op.add_column(
        'folders',
        sa.Column(
            'prompt_embedding',
            sa.JSON(),
            nullable=True,
            comment='Vector embedding array of the original prompt'
        )
    )


def downgrade() -> None:
    # Drop column on rollback
    op.drop_column('folders', 'prompt_embedding')
