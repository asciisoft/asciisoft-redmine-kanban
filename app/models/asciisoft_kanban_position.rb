# frozen_string_literal: true

# 열 안의 카드 순서
class AsciisoftKanbanPosition < ApplicationRecord
  self.table_name = 'asciisoft_kanban_positions'
  belongs_to :issue

  def self.save_order(issue_ids)
    issue_ids.each_with_index do |id, i|
      pos = find_or_initialize_by(issue_id: id)
      pos.position = i + 1
      pos.save if pos.changed?
    end
  end
end
