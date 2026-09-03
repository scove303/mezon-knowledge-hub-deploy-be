"""add_refresh_token_table

Revision ID: 1ffd70ac862e
Revises: 1a2b3c4d5e6f
Create Date: 2026-09-03 21:07:17.028729

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '1ffd70ac862e'
down_revision: Union[str, Sequence[str], None] = '1a2b3c4d5e6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tạo bảng refreshtoken
    op.create_table(
        'refreshtoken',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('jti', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refreshtoken_jti'), 'refreshtoken', ['jti'], unique=True)
    op.create_index(op.f('ix_refreshtoken_user_id'), 'refreshtoken', ['user_id'], unique=False)


def downgrade() -> None:
    # Xóa bảng refreshtoken khi rollback
    op.drop_index(op.f('ix_refreshtoken_user_id'), table_name='refreshtoken')
    op.drop_index(op.f('ix_refreshtoken_jti'), table_name='refreshtoken')
    op.drop_table('refreshtoken')