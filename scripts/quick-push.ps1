param (
    [string]$Message = "update"
)

git add -A
git commit -m "$Message"
git pull --rebase
git push

Write-Output "`n✅ Blog sync complete. GitHub Action will build and publish /blog/.`n"
