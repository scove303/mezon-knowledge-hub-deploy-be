"""add shared_chat tables

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-08-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'c8d9e0f1a2b3'
down_revision = 'b7c8d9e0f1a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create shared_chats table
    op.create_table(
        'shared_chats',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('folder_snapshot', sa.JSON(), nullable=False),
        sa.Column('conversation_history', sa.JSON(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.String(1000), nullable=True),
        sa.Column('topic', sa.String(500), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('share_code', sa.String(20), nullable=False),
        sa.Column('import_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('share_code'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
    )
    op.create_index('ix_shared_chats_creator_id', 'shared_chats', ['creator_id'], unique=False)
    op.create_index('ix_shared_chats_share_code', 'shared_chats', ['share_code'], unique=True)
    op.create_index('ix_shared_chats_is_public', 'shared_chats', ['is_public'], unique=False)

    # Create chat_imports table
    op.create_table(
        'chat_imports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shared_chat_id', sa.String(50), nullable=False),
        sa.Column('importer_id', sa.Integer(), nullable=False),
        sa.Column('folder_id', sa.String(50), nullable=False),
        sa.Column('imported_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['importer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shared_chat_id'], ['shared_chats.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
    )
    op.create_index('ix_chat_imports_shared_chat_id', 'chat_imports', ['shared_chat_id'], unique=False)
    op.create_index('ix_chat_imports_importer_id', 'chat_imports', ['importer_id'], unique=False)
    op.create_index('ix_chat_imports_folder_id', 'chat_imports', ['folder_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_chat_imports_folder_id', table_name='chat_imports')
    op.drop_index('ix_chat_imports_importer_id', table_name='chat_imports')
    op.drop_index('ix_chat_imports_shared_chat_id', table_name='chat_imports')
    op.drop_table('chat_imports')
    op.drop_index('ix_shared_chats_is_public', table_name='shared_chats')
    op.drop_index('ix_shared_chats_share_code', table_name='shared_chats')
    op.drop_index('ix_shared_chats_creator_id', table_name='shared_chats')
    op.drop_table('shared_chats')