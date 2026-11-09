# frozen_string_literal: true

get  'projects/:project_id/kanban', to: 'asciisoft_kanban#show', as: 'project_asciisoft_kanban'
get  'projects/:project_id/kanban/card/:id', to: 'asciisoft_kanban#card', as: 'asciisoft_kanban_card'
get  'projects/:project_id/kanban/allowed/:id', to: 'asciisoft_kanban#allowed', as: 'asciisoft_kanban_allowed'
post 'projects/:project_id/kanban/move', to: 'asciisoft_kanban#move', as: 'asciisoft_kanban_move'
post 'projects/:project_id/kanban/issues', to: 'asciisoft_kanban#create_issue', as: 'asciisoft_kanban_create_issue'
post 'projects/:project_id/kanban/settings', to: 'asciisoft_kanban#save_settings', as: 'asciisoft_kanban_settings'
