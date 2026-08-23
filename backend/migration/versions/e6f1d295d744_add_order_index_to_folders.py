"""add order_index to folders

Revision ID: e6f1d295d744
Revises: 3185770ec2a5
Create Date: 2026-08-23 07:43:26.430160

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = 'e6f1d295d744'
down_revision: Union[str, Sequence[str], None] = '3185770ec2a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # order_index already added manually, just update the alembic version
    pass


def downgrade() -> None:
    op.drop_column('folders', 'order_index')