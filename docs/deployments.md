# 배포 이력 관리

본 레포는 **GitHub Deployments API** 를 이용해 각 배포 시도의 이력을 자동 기록합니다.
레포 상단 **`Environments`** 패널 / **`Deployments`** 탭에서 시간순으로 확인 가능하며,
각 이력은 해당 Actions 실행 로그와 환경 URL 에 1:1 로 연결됩니다.

> 대상 환경: `test` (http://172.22.0.148:4000)
> 워크플로우: [`.github/workflows/deploy-test.yml`](../.github/workflows/deploy-test.yml)

---

## 동작 방식

```
main 에 push  ─┐
 수동 실행   ─┤──▶  Actions runner
              │
              ▼
        Deployment 레코드 생성 (state=in_progress)
              │
              ▼
    npm ci · typecheck · build
              │
    ┌─────────┴─────────┐
    ▼                   ▼
  성공                 실패
Deployment          Deployment
state=success       state=failure
```

각 단계는 GitHub Deployments API 로 기록됩니다:

| 단계 | API 호출 |
| --- | --- |
| 배포 시작 | `POST /repos/:owner/:repo/deployments` |
| 진행 중 | `POST /repos/:owner/:repo/deployments/:id/statuses` (state=in_progress) |
| 성공 | `POST /repos/:owner/:repo/deployments/:id/statuses` (state=success) |
| 실패 | `POST /repos/:owner/:repo/deployments/:id/statuses` (state=failure) |

`GITHUB_TOKEN` 의 `deployments: write` 권한으로 호출하므로 별도 시크릿이 필요 없습니다.

---

## 트리거

1. **자동**: `main` 브랜치에 push
   - `**/*.md`, `docs/**` 변경만 있을 때는 skip
2. **수동**: GitHub Actions 화면에서 "Deploy (test)" → Run workflow
   - 입력 `ref`로 특정 SHA/브랜치를 배포할 수 있음 (rollback 용도)

---

## 현재 구성의 범위

- ✅ 배포 이력 기록 (GitHub Deployments 탭)
- ✅ typecheck / build 검증
- ✅ `test` 환경으로 고정 (staging/prod 분리는 추후 도입)
- ⏳ **실제 원격 배포 스크립트는 placeholder 상태**
  - `Deploy step (placeholder)` 만 실행되어 항상 성공으로 기록됨
  - 실제 SSH 배포가 필요해지면 아래 "실제 배포 연결" 참조

---

## 실제 배포 연결 (추후)

### 1) 시크릿 등록
GitHub → 레포 Settings → Secrets and variables → Actions

| 시크릿 | 설명 |
| --- | --- |
| `DEPLOY_SSH_KEY` | 테스트 서버 접속용 개인키 |
| `DEPLOY_SSH_HOST` | `172.22.0.148` |
| `DEPLOY_SSH_USER` | 서버 계정 |

### 2) Environment protection
GitHub → Settings → Environments → `test` 생성
- Required reviewers 설정 가능 (수동 승인 후 배포)
- Secrets 를 환경에 귀속시키면 다른 환경과 분리 가능

### 3) 워크플로우 수정
`.github/workflows/deploy-test.yml` 의 `Deploy step (placeholder)` 를 아래와 같이 교체:

```yaml
- name: Load SSH key
  uses: webfactory/ssh-agent@v0.9.0
  with:
    ssh-private-key: ${{ secrets.DEPLOY_SSH_KEY }}

- name: Deploy via SSH
  run: |
    ssh -o StrictHostKeyChecking=accept-new \
        ${{ secrets.DEPLOY_SSH_USER }}@${{ secrets.DEPLOY_SSH_HOST }} <<'EOF'
      set -e
      cd /opt/msnavi
      git fetch --all
      git checkout ${{ github.sha }}
      docker compose pull
      docker compose up -d --build
      curl -f http://localhost:4000/api/health
    EOF
```

---

## 배포 이력 확인 방법

1. **GitHub 웹**: 레포 메인 페이지 우측 Environments → `test` 클릭
2. **Deployments 탭**: `https://github.com/myoungsuking/msnavi/deployments`
3. **gh CLI**:
   ```bash
   gh api repos/myoungsuking/msnavi/deployments --jq '.[] | {id, sha, environment, created_at}'
   gh api repos/myoungsuking/msnavi/deployments/<ID>/statuses
   ```

---

## 수동 배포 이력 추가 (Actions 우회 시)

긴급 hotfix 등으로 Actions 를 우회해 서버에 직접 배포한 경우도 이력을 남기는 것을 권장합니다:

```bash
# 토큰은 `repo` + `deployments:write` 스코프 필요
gh api repos/myoungsuking/msnavi/deployments \
  -f ref=<sha> \
  -f environment=test \
  -f description="manual hotfix" \
  -F auto_merge=false \
  -F required_contexts='[]'
# 반환된 id 로 상태 업데이트
gh api repos/myoungsuking/msnavi/deployments/<id>/statuses \
  -f state=success \
  -f environment_url=http://172.22.0.148:4000 \
  -f description="manual deploy by <name>"
```

> 추후 staging/prod 환경 분리, release 태그 연동, Slack/Discord 알림 등은
> 운영 피드백 보고 단계적으로 추가하는 것을 권장합니다.
