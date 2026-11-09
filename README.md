# asciisoft_kanban (v1.3.0)

[한국어](README.ko.md)

A Kanban board plugin for Redmine 7.0. It shows a project's issues as cards in status columns.

## Features
- One column per issue status, with a tinted column area and a color per status
- Drag a card with the mouse to another column to change its status (follows the workflow; only **administrators and the assignee** can move a card)
- With assignee swimlanes, drag a card to another assignee row to change the assignee
- Card order inside a column is saved
- Swimlanes: none / assignee / tracker / priority (choose on the screen)
- Per-column WIP limit (the column header turns red when exceeded)
- Hide columns per project (Columns button — administrators and users with the "Edit project" permission)
- Click a card to open a detail popup (attributes, description, recent comments, status buttons)
- Add an issue from a column with the **+** button (subject only)
- Uses the same filters as the issue list; up to 500 cards are shown
- Priority color on the card's left border, status summary bar on top

## Requirements
- Redmine **7.0 or later**

## Install with git
The plugin folder name **must be `asciisoft_kanban`**.

```bash
cd /path/to/redmine/plugins
git clone https://github.com/asciisoft/asciisoft-redmine-kanban.git asciisoft_kanban
cd ..
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
# then restart Redmine (Puma, Passenger, ...)
```

### Docker (official `redmine` image)
Mount the plugins folder in `compose.yaml`, for example `./plugins:/usr/src/redmine/plugins`, and then:

```bash
cd /path/to/compose
git clone https://github.com/asciisoft/asciisoft-redmine-kanban.git plugins/asciisoft_kanban
docker compose restart redmine
```

The two database tables are created automatically when `REDMINE_PLUGINS_MIGRATE: "true"` is set. Otherwise run:

```bash
docker compose exec redmine bundle exec rake redmine:plugins:migrate NAME=asciisoft_kanban RAILS_ENV=production
```

### Private repository
If the repository is private, `git clone` asks for credentials. Use your GitHub user name and a **fine-grained personal access token** (Contents: read-only) as the password.

## Set up
1. **Administration → Roles and permissions**: check **View kanban** for the roles that may use it.
2. **Project → Settings → Modules**: check **Kanban**. A "Kanban" tab appears in the project menu.

## Update
```bash
cd /path/to/redmine/plugins/asciisoft_kanban
git pull --ff-only
cd ../..
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
# restart Redmine
```

## Uninstall
```bash
cd /path/to/redmine
bundle exec rake redmine:plugins:migrate NAME=asciisoft_kanban VERSION=0 RAILS_ENV=production
rm -rf plugins/asciisoft_kanban
# restart Redmine
```

## Notes
- The look follows the ASCII SOFT theme variables when the theme is installed, and uses default blue colors otherwise.
- Profile photos on cards use Redmine's `avatar` helper, so they follow Gravatar or an avatar plugin such as `asciisoft_redmine_avatar`.

## License
GNU General Public License v2.0 — see [LICENSE](LICENSE).
