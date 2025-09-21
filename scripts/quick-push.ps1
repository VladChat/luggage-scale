param (
    [string]$Message = "update"
)

# Stage all changes (new, modified, deleted)
git add -A

# Commit with provided message
git commit -m "$Message"

# Rebase from remote (safe sync)
git pull --rebase

# Push to origin
git push

Write-Output "`n✅ Blog sync complete. GitHub Action will build and publish /blog/.`n"
