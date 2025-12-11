#!/bin/bash
# A script to safely reset the Git history of this repository.

# Step 1: Ensure the user is in the right directory
if [ ! -d ".git" ]; then
  echo "Error: This script must be run from the root of your project directory."
  exit 1
fi

echo "This script will reset your Git history to fix upload issues."
echo "Your current code will be preserved."
read -p "Are you sure you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Step 2: Remove the old, bloated .git directory
echo "Removing old Git history..."
rm -rf .git

# Step 3: Initialize a new, clean Git repository
echo "Creating a new, clean repository..."
git init

# Step 4: Add all your current code to the new repository
echo "Adding all your project files..."
git add .

# Step 5: Create the first commit in your new repository
echo "Creating the initial commit..."
git commit -m "Initial commit of cleaned project"

# Step 6: Inform the user of the next steps
echo ""
echo "SUCCESS: Your project's Git history has been reset."
echo "Your code is safe and has been committed."
echo ""
echo "NEXT STEPS:"
echo "1. Go to your GitHub repository page."
echo "2. Find the SSH or HTTPS URL for your repository (e.g., git@github.com:user/repo.git)."
echo "3. Run the following command, replacing the URL with your own:"
echo "   git remote add origin YOUR_GITHUB_REPOSITORY_URL"
echo ""
echo "4. Finally, run this command to push your clean project to GitHub:"
echo "   git push --force --set-upstream origin main"
echo ""
