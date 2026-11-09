# ASCII SOFT Kanban (Redmine 7 plugin)

요청을 상태별 열로 보여주는 칸반보드입니다.

## 기능
- 상태별 열, 카드를 끌어 놓아 상태 변경 (업무흐름 기준, **관리자와 작업자(담당자 · 담당 그룹 구성원)만**)
- 열 안 카드 순서 저장
- 가로줄(스윔레인): 없음 · 담당자 · 유형 · 우선순위 (화면에서 선택, 브라우저에 기억)
- 열별 최대 카드 수(WIP) 표시, 넘으면 열 제목이 빨갛게 표시
- 프로젝트별 열 숨김 (열 설정 — 관리자 · 프로젝트 관리 권한)
- 카드 클릭 시 상세 팝업 (속성, 설명, 최근 댓글 5개, 상태 변경 버튼)
- 열 머리의 [+]로 제목만 입력해 새 요청 추가 (필수 항목이 있으면 '자세히 입력' 링크)
- 요청 목록과 같은 검색조건 사용, 카드는 최대 500개 표시
- 터치 화면처럼 끌기가 어려운 환경에서는 카드 팝업의 상태 버튼으로 변경

## 설치 (Docker compose 기준)
폴더 이름은 반드시 `asciisoft_kanban`입니다.

```bash
cd /srv/redmine
git clone https://github.com/asciisoft/asciisoft-redmine-kanban.git plugins/asciisoft_kanban
docker compose restart redmine     # REDMINE_PLUGINS_MIGRATE=true 이면 DB 테이블 2개가 자동 생성
```

마이그레이션이 자동으로 되지 않는 환경이면:
`docker compose exec redmine bundle exec rake redmine:plugins:migrate NAME=asciisoft_kanban RAILS_ENV=production`

## 사용 설정
1. 관리 > 역할 및 권한: 칸반을 볼 역할에 **칸반 보기** 권한을 체크합니다.
2. 프로젝트 > 설정 > 모듈: **칸반**을 체크하면 프로젝트 메뉴의 '요청' 옆에 '칸반' 탭이 생깁니다.

## 제거
```bash
docker compose exec redmine bundle exec rake redmine:plugins:migrate NAME=asciisoft_kanban VERSION=0 RAILS_ENV=production
rm -rf plugins/asciisoft_kanban
docker compose restart redmine
```
