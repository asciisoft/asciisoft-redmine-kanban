# frozen_string_literal: true

# 프로젝트별 칸반 설정: 숨길 상태(열), 열별 WIP 제한
class AsciisoftKanbanSetting < ApplicationRecord
  self.table_name = 'asciisoft_kanban_settings'
  belongs_to :project

  def self.for(project)
    find_by(project_id: project.id) || new(project_id: project.id)
  end

  def hidden_ids
    hidden_status_ids.to_s.split(',').map(&:to_i).select(&:positive?)
  end

  def hidden_ids=(ids)
    self.hidden_status_ids = Array(ids).map(&:to_i).select(&:positive?).uniq.join(',')
  end

  def limits
    JSON.parse(wip_limits.presence || '{}').transform_keys(&:to_i).transform_values(&:to_i).select {|_, v| v.positive? }
  rescue JSON::ParserError
    {}
  end

  def limits=(hash)
    clean = (hash || {}).to_h.each_with_object({}) do |(k, v), h|
      n = v.to_i
      h[k.to_i] = n if k.to_i.positive? && n.positive?
    end
    self.wip_limits = clean.to_json
  end
end
