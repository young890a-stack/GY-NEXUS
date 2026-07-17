# GitHub 운영 가이드

## 최초 업로드

```bash
git init
git add .
git commit -m "release: GY-NEXUS AI Company OS v2.0 foundation"
git branch -M main
git remote add origin <대표님의 GitHub 저장소 주소>
git push -u origin main
```

## 이후 성장 방식

```bash
git checkout -b develop
git push -u origin develop
git checkout -b feature/ali-connector
```

기능은 `feature/*`에서 개발하고 검증 후 `develop`, 운영 승인 후 `main`으로 합칩니다. 비밀키는 GitHub에 올리지 않고 로컬 `.env.local` 또는 배포 서비스의 Secrets에 저장합니다.
