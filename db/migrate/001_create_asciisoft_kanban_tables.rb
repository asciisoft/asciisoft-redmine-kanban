# frozen_string_literal: true

# 제거: bundle exec rake redmine:plugins:migrate NAME=asciisoft_kanban VERSION=0 RAILS_ENV=production
class CreateAsciisoftKanbanTables < ActiveRecord::Migration[7.2]
  def change
    create_table :asciisoft_kanban_settings do |t|
      t.integer :project_id, null: false
      t.text    :hidden_status_ids
      t.text    :wip_limits
      t.timestamps null: false
    end
    add_index :asciisoft_kanban_settings, :project_id, unique: true

    create_table :asciisoft_kanban_positions do |t|
      t.integer :issue_id, null: false
      t.integer :position, null: false, default: 0
    end
    add_index :asciisoft_kanban_positions, :issue_id, unique: true
  end
end
