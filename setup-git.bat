@echo off
echo Setting up Git repository...

REM Initialize git repository
git init

REM Add all files
git add .

REM Create initial commit
git commit -m "Initial commit: CRM system with order management, price calculator, and materials tracking"

REM Add remote origin (replace with your GitHub repository URL)
echo.
echo Please add your GitHub repository URL:
echo Example: https://github.com/username/crm-system.git
echo.
set /p repo_url="Enter GitHub repository URL: "

if not "%repo_url%"=="" (
    git remote add origin %repo_url%
    echo.
    echo Repository setup complete!
    echo.
    echo Next steps:
    echo 1. Push to GitHub: git push -u origin main
    echo 2. Or push to master: git push -u origin master
) else (
    echo.
    echo Repository initialized locally.
    echo Add remote later with: git remote add origin YOUR_REPO_URL
)

pause
