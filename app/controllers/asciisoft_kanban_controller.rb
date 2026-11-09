# frozen_string_literal: true

class AsciisoftKanbanController < ApplicationController
  menu_item :asciisoft_kanban
  before_action :find_project_by_project_id, :authorize
  before_action :find_issue, only: [:card, :allowed]

  helper :issues
  helper :queries

  LIMIT = 500
  SWIMLANES = %w[none assignee tracker priority].freeze

  helper_method :status_changeable?, :can_configure?, :kb_status_color, :kb_priority_kind

  # 우선순위 단계: 이름으로 정하고, 모르는 이름은 레드마인 순서(css 클래스)로
  PRIORITY_KINDS = {
    '긴급조치' => 'highest', '즉시' => 'highest', '긴급' => 'highest', 'immediate' => 'highest', 'urgent' => 'highest',
    '높음' => 'high', 'high' => 'high', '중간' => 'default', '보통' => 'default', 'normal' => 'default',
    '낮음' => 'low', 'low' => 'low', '매우낮음' => 'lowest', '매우 낮음' => 'lowest', 'lowest' => 'lowest'
  }.freeze
  PRIORITY_RANK = {'highest' => 5, 'high' => 4, 'default' => 3, 'low' => 2, 'lowest' => 1}.freeze

  STATUS_COLORS = {
    '신규등록' => '#4f7cc8', '신규' => '#4f7cc8', 'new' => '#4f7cc8',
    '검토중' => '#7c5ce6', 'feedback' => '#7c5ce6',
    '진행중' => '#22a06b', 'in progress' => '#22a06b',
    '테스트중' => '#e0a100', 'resolved' => '#e0a100',
    '완료' => '#8a94a6', 'closed' => '#8a94a6',
    '반려' => '#e5484d', 'rejected' => '#e5484d'
  }.freeze
  PALETTE = %w[#4f7cc8 #7c5ce6 #22a06b #e0a100 #0ea5e9 #d9468f #8a94a6].freeze

  def show
    @setting = AsciisoftKanbanSetting.for(@project)
    @hidden_ids = @setting.hidden_ids
    @limits = @setting.limits
    @all_statuses = IssueStatus.sorted.to_a
    @statuses = @all_statuses.reject {|s| @hidden_ids.include?(s.id) }
    @swimlane = SWIMLANES.include?(params[:swimlane]) ? params[:swimlane] : 'none'

    @query = IssueQuery.new(name: '_', project: @project)
    if params[:set_filter].present?
      @query.build_from_params(params)
    else
      @query.filters = {'status_id' => {operator: '*', values: ['']}}
    end
    @issues = @query.issues(limit: LIMIT, include: [:assigned_to, :tracker, :priority, :status, :project]).to_a
    @truncated = @issues.size >= LIMIT
    ids = @issues.map(&:id)
    @comment_counts = Journal.visible.where(journalized_type: 'Issue', journalized_id: ids)
                             .where.not(notes: [nil, '']).group(:journalized_id).count
    @attach_counts = Attachment.where(container_type: 'Issue', container_id: ids).group(:container_id).count
    @positions = AsciisoftKanbanPosition.where(issue_id: ids).pluck(:issue_id, :position).to_h
    @lanes = build_lanes(@issues)
    @can_add = User.current.allowed_to?(:add_issues, @project) && Issue.allowed_target_trackers(@project).any?
  rescue ::Query::StatementInvalid
    render_error l(:error_query_statement_invalid)
  end

  # 카드 상세 팝업
  def card
    @journals = @issue.journals.visible.where.not(notes: [nil, '']).order(created_on: :desc).limit(5).to_a.reverse
    @can_change = status_changeable?(@issue)
    @allowed = @can_change ? @issue.new_statuses_allowed_to(User.current) : []
    @assignables = @can_change ? @issue.assignable_users.to_a : []
    @actual_cf = actual_field
    @actual_value = @actual_cf && @issue.available_custom_fields.include?(@actual_cf) ? @issue.custom_field_value(@actual_cf).presence : nil
    render partial: 'asciisoft_kanban/popup', layout: false
  end

  # 끌어 놓을 수 있는 상태
  def allowed
    ids = status_changeable?(@issue) ? @issue.new_statuses_allowed_to(User.current).map(&:id) : []
    render json: {current: @issue.status_id, ids: ids}
  end

  # 상태 변경 + 열 안 순서 저장
  def move
    issue = project_issue(params[:issue_id])
    return render_json_error(:not_found) unless issue
    return render_json_error(:forbidden) unless status_changeable?(issue)

    issue.init_journal(User.current)
    changed = false
    status = IssueStatus.find_by(id: params[:status_id])
    if status && status.id != issue.status_id
      unless issue.new_statuses_allowed_to(User.current).include?(status)
        return render_json_error(:forbidden, l(:notice_not_authorized))
      end

      issue.status = status
      changed = true
    end
    # 담당자 변경: 팝업에서 고른 경우(assigned_to_id) 또는 가로줄이 '담당자'일 때 다른 줄로 옮긴 경우
    lane_match = params[:swimlane] == 'assignee' && params[:lane].to_s.match(/\Aa(\d+)\z/)
    if params.key?(:assigned_to_id) || lane_match
      aid = params.key?(:assigned_to_id) ? params[:assigned_to_id].to_i : lane_match[1].to_i
      aid = nil if aid.zero?
      if aid != issue.assigned_to_id
        if aid && issue.assignable_users.none? {|u| u.id == aid }
          return render_json_error(:forbidden, l(:text_asciisoft_kanban_not_assignable))
        end

        issue.assigned_to_id = aid
        changed = true
      end
    end
    if changed && !issue.save
      return render json: {error: issue.errors.full_messages.join(', ')}, status: :unprocessable_content
    end

    order = Array(params[:order]).map(&:to_i).select(&:positive?).first(LIMIT)
    visible = Issue.visible.where(id: order, project_id: project_ids).pluck(:id)
    AsciisoftKanbanPosition.save_order(order.select {|id| visible.include?(id) })
    @comment_counts = Journal.visible.where(journalized_type: 'Issue', journalized_id: issue.id).where.not(notes: [nil, '']).group(:journalized_id).count
    @attach_counts = Attachment.where(container_type: 'Issue', container_id: issue.id).group(:container_id).count
    html = changed ? render_to_string(partial: 'asciisoft_kanban/card', locals: {issue: issue.reload}, formats: [:html]) : nil
    render json: {ok: true, id: issue.id, html: html, status: {id: issue.status_id, name: issue.status.name, closed: issue.closed?}}
  end

  # 열에서 바로 새 요청 추가 (제목만)
  def create_issue
    return render_json_error(:forbidden) unless User.current.allowed_to?(:add_issues, @project)

    issue = Issue.new(project: @project, author: User.current)
    issue.tracker = Issue.allowed_target_trackers(@project).first
    issue.safe_attributes = {'subject' => params[:subject].to_s.strip}
    status = IssueStatus.find_by(id: params[:status_id])
    issue.status = status if status && issue.new_statuses_allowed_to(User.current).include?(status)
    if issue.save
      @comment_counts = {}
      @attach_counts = {}
      html = render_to_string(partial: 'asciisoft_kanban/card', locals: {issue: issue}, formats: [:html])
      render json: {ok: true, id: issue.id, status_id: issue.status_id, html: html}
    else
      render json: {error: issue.errors.full_messages.join(', '),
                    new_url: new_project_issue_path(@project, issue: {subject: issue.subject, status_id: params[:status_id]})},
             status: :unprocessable_content
    end
  end

  # 숨길 열 · WIP 제한 저장
  def save_settings
    return render_403 unless can_configure?

    setting = AsciisoftKanbanSetting.for(@project)
    setting.hidden_ids = params[:hidden]
    setting.limits = params[:wip]&.to_unsafe_h
    setting.save
    flash[:notice] = l(:notice_successful_update)
    redirect_to project_asciisoft_kanban_path(@project, swimlane: params[:swimlane].presence)
  end

  private

  def find_issue
    @issue = project_issue(params[:id])
    render_404 unless @issue
  end

  def project_ids
    @project_ids ||= @project.self_and_descendants.pluck(:id)
  end

  def project_issue(id)
    Issue.visible.where(project_id: project_ids).find_by(id: id.to_i)
  end

  # 관리자와 작업자(담당자 · 담당 그룹 구성원)만
  def status_changeable?(issue)
    user = User.current
    return false unless issue && user.logged?
    return true if user.admin?

    aid = issue.assigned_to_id
    aid.present? && (aid == user.id || user.group_ids.include?(aid))
  end

  # 상태 열 색: 이름으로 정하고, 모르는 상태는 순서대로 팔레트 색
  def kb_status_color(status)
    STATUS_COLORS[status.name.to_s.strip.downcase] || STATUS_COLORS[status.name.to_s.strip] ||
      (status.is_closed? ? '#8a94a6' : PALETTE[(status.position.to_i - 1) % PALETTE.size])
  end

  def kb_priority_kind(priority)
    return 'default' unless priority

    PRIORITY_KINDS[priority.name.to_s.strip.downcase] || PRIORITY_KINDS[priority.name.to_s.strip] ||
      case priority.css_classes.to_s
      when /highest/ then 'highest'
      when /high/ then 'high'
      when /lowest/ then 'lowest'
      when /low/ then 'low'
      else 'default'
      end
  end

  def priority_rank(priority)
    PRIORITY_RANK[kb_priority_kind(priority)] || 3
  end

  # 실제 완료일 필드: asciisoft_portal 플러그인 설정을 따르고, 없으면 '완료일'
  def actual_field
    s = Setting.respond_to?(:plugin_asciisoft_portal) ? Setting.plugin_asciisoft_portal : nil
    name = (s.is_a?(Hash) && (s['actual_field'] || s[:actual_field])).to_s.strip
    IssueCustomField.find_by(name: name.presence || '완료일')
  rescue StandardError
    nil
  end

  def can_configure?
    User.current.admin? || User.current.allowed_to?(:edit_project, @project)
  end

  def render_json_error(status, message = nil)
    render json: {error: message || status.to_s}, status: status
  end

  def sort_cards(list)
    list.sort_by do |i|
      pos = @positions[i.id]
      [pos ? 0 : 1, pos || 0, -priority_rank(i.priority), -i.updated_on.to_i]
    end
  end

  # 가로줄(스윔레인): [키, 이름, 상태별 카드]
  def build_lanes(issues)
    groups =
      case @swimlane
      when 'assignee'
        issues.group_by(&:assigned_to).sort_by {|p, _| p ? [0, p.name] : [1, ''] }
              .map {|p, list| [p ? "a#{p.id}" : 'a0', p ? p.name : l(:label_asciisoft_kanban_unassigned), list] }
      when 'tracker'
        issues.group_by(&:tracker).sort_by {|t, _| t&.position || 0 }
              .map {|t, list| ["t#{t&.id}", t&.name.to_s, list] }
      when 'priority'
        issues.group_by(&:priority).sort_by {|p, _| [-priority_rank(p), p&.position || 0] }
              .map {|p, list| ["p#{p&.id}", p&.name.to_s, list] }
      else
        [['all', nil, issues]]
      end
    groups.map do |key, name, list|
      by_status = list.group_by(&:status_id)
      cells = @statuses.to_h {|s| [s.id, sort_cards(by_status[s.id] || [])] }
      {key: key, name: name, cells: cells, count: list.size}
    end
  end
end
