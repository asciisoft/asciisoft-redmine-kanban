# frozen_string_literal: true

# ASCII SOFT Kanban — Redmine 7 칸반보드 플러그인
Redmine::Plugin.register :asciisoft_kanban do
  name 'ASCII SOFT Kanban'
  author 'ASCII SOFT'
  description '상태별 칸반보드: 끌어서 상태 변경, 스윔레인, WIP 제한, 카드 순서 저장, 상세 팝업, 빠른 요청 추가'
  version '1.7.1'
  url 'https://asciisoft.com'
  requires_redmine version_or_higher: '7.0.0'

  project_module :asciisoft_kanban do
    permission :view_asciisoft_kanban,
               {asciisoft_kanban: [:show, :card, :allowed, :move, :create_issue, :save_settings]},
               read: true
  end

  menu :project_menu, :asciisoft_kanban,
       {controller: 'asciisoft_kanban', action: 'show'},
       caption: :label_asciisoft_kanban, after: :issues, param: :project_id
end
