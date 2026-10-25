# NoteApp — web demo DevSecOps (CÓ lỗ hổng)

> Ứng dụng web Node.js/Express **cố ý chứa lỗ hổng**, kèm **pipeline bảo mật ngay trong repo** (`.github/workflows/devsecops.yml`). Chỉ cần push thư mục này lên GitHub là Actions tự quét.

## Lỗ hổng (để demo)
SQL Injection · IDOR · Hardcoded secret · MD5 · Thiếu security headers · Reflected XSS · Stored XSS · Dependency CVE.

## Chạy local
```bash
npm install
npm start          # http://localhost:3000
```
Khai thác thử:
```bash
# SQLi (bypass admin)
curl -s -X POST http://localhost:3000/login -H "Content-Type: application/x-www-form-urlencoded" --data-raw "username=' OR '1'='1' -- &password=x"
# IDOR
curl -s http://localhost:3000/profile/1
# Reflected XSS (mo trinh duyet): http://localhost:3000/search?q=<script>alert(1)</script>
```

## Pipeline bảo mật (tự động trên GitHub)
File [`.github/workflows/devsecops.yml`](.github/workflows/devsecops.yml) — 5 tầng:
`secret-scan (Gitleaks) → sast (Semgrep) → sca (npm audit + Trivy + SBOM) → build + image/IaC scan (Hadolint/Checkov/Trivy) → dast (OWASP ZAP + test IDOR)`.

Cấu hình kèm theo: `.semgrep/rules.yml`, `.gitleaks.toml`, `Dockerfile`.

## Push lên GitHub (chỉ thư mục này)
```bash
cd app
git init
git add .
git commit -m "NoteApp - web co lo hong + pipeline DevSecOps"
git branch -M main
git remote add origin git@github.com:<tai-khoan>/<repo>.git
git push -u origin main
```
Vào tab **Actions** → xem pipeline chạy 5 job.

> Secret ký JWT là chuỗi random generic nên GitHub **Push Protection** thường không chặn (nó chỉ chặn format nhà cung cấp đã biết); việc phát hiện secret do Gitleaks + pre-commit hook + Semgrep đảm nhiệm.

## ⚠️ An toàn
App có lỗ hổng thật → chỉ chạy trong lab/local, không public ra Internet.
