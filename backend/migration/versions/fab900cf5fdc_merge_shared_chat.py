"""merge shared_chat

Revision ID: fab900cf5fdc
Revises: 72b263e29268, c8d9e0f1a2b3
Create Date: 2026-08-28 10:31:11.030950

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fab900cf5fdc'
down_revision: Union[str, Sequence[str], None] = ('72b263e29268', 'c8d9e0f1a2b3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
