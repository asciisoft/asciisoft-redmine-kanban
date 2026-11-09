# asciisoft_kanban (v1.6.0)

[English](README.md)

Redmine 7.0용 칸반보드 플러그인입니다. 프로젝트의 요청을 상태별 열에 카드로 보여줍니다.

## 기능
- 상태별 열: 열마다 영역을 잡고 상태 색을 표시
- 카드를 마우스로 다른 열에 끌어 놓아 상태 변경 (업무흐름 기준, **관리자와 작업자(담당자)만** 이동 가능)
- 가로줄이 담당자일 때 다른 담당자 줄로 끌어 놓으면 담당자 변경
- 열 안 카드 순서 저장
- 가로줄(스윔레인): 없음 / 담당자 / 유형 / 우선순위 (화면에서 선택)
- 열별 최대 카드 수(WIP) 제한 (넘으면 열 제목이 빨갛게 표시)
- 프로젝트별 열 숨김 (열 설정 — 관리자, "프로젝트 편집" 권한 보유자)
- 카드를 누르면 상세 팝업 (속성, 설명, 최근 댓글, 상태 변경 버튼)
- 열 머리의 **+** 버튼으로 새 요청 추가 (제목만 입력)
- 요청 목록과 같은 검색조건 사용, 카드는 최대 500개 표시
- 카드 왼쪽 테두리에 우선순위 색, 위쪽에 상태별 요약 막대

## 요구 사항
- Redmine **7.0 이상**

## git으로 설치
플러그인 폴더 이름은 반드시 **`asciisoft_kanban`**이어야 합니다.

```bash
cd /레드마인경로/plugins
git clone https://github.com/asciisoft/asciisoft-redmine-kanban.git asciisoft_kanban
cd ..
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
# 이후 레드마인 재시작 (Puma, Passenger 등)
```

### Docker (공식 `redmine` 이미지)
`compose.yaml`에 plugins 폴더를 연결해 둡니다. 예: `./plugins:/usr/src/redmine/plugins`

```bash
cd /compose경로
git clone https://github.com/asciisoft/asciisoft-redmine-kanban.git plugins/asciisoft_kanban
docker compose restart redmine
```

`REDMINE_PLUGINS_MIGRATE: "true"`가 설정되어 있으면 DB 테이블 2개가 자동으로 만들어집니다. 아니면 아래 명령을 실행합니다.

```bash
docker compose exec redmine bundle exec rake redmine:plugins:migrate NAME=asciisoft_kanban RAILS_ENV=production
```

### private 저장소인 경우
`git clone` 때 인증을 물어봅니다. 사용자명에 GitHub 아이디, 비밀번호에 **fine-grained 개인 액세스 토큰**(Contents: Read-only)을 입력하세요.

## 사용 설정
1. **관리 → 역할 및 권한**: 칸반을 쓸 역할에 **칸반 보기** 권한을 체크합니다.
2. **프로젝트 → 설정 → 모듈**: **칸반**을 체크하면 프로젝트 메뉴에 "칸반" 탭이 생깁니다.

## 업데이트
```bash
cd /레드마인경로/plugins/asciisoft_kanban
git pull --ff-only
cd ../..
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
# 레드마인 재시작
```

## 제거
```bash
cd /레드마인경로
bundle exec rake redmine:plugins:migrate NAME=asciisoft_kanban VERSION=0 RAILS_ENV=production
rm -rf plugins/asciisoft_kanban
# 레드마인 재시작
```

## 참고
- ASCII SOFT 테마가 설치되어 있으면 테마 색 변수를 따르고, 없으면 기본 파란색 계열로 표시됩니다.
- 카드의 프로필 사진은 레드마인 `avatar` 헬퍼를 쓰므로 Gravatar나 `asciisoft_redmine_avatar` 같은 아바타 플러그인을 따릅니다.

## 라이선스
GNU General Public License v2.0 — [LICENSE](LICENSE) 참고.
