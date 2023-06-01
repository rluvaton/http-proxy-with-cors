#!/bin/bash env

# Inspired by https://stackoverflow.com/a/23486788/5923666
create-new-app () {
  # Reset
  RESET_COLOR='\033[0m'

  # Regular Colors
  GREEN='\033[0;32m'

  target_dir="${1:-my-new-app}"

  echo "${GREEN}Creating new project '$target_dir':${RESET_COLOR}"

  mkdir -p "$target_dir"
  cd "$target_dir"

  echo -e "\n${GRREN}Getting the code from the node-boilerplate:${RESET_COLOR}"

  # Init new application
  git init

  # Get the boilerplate code without adding it as a remote
  git fetch --depth=1 -n https://github.com/rluvaton/node-boilerplate.git

  # Squash all the boilerplate commits into one initial commit
  git reset --hard $(git commit-tree FETCH_HEAD^{tree} -m "initial commit")

  echo -e "\n${GREEN}Switching to the project node version:${RESET_COLOR}"

  # This should use the node version from the .nvmrc file
  nvm use

  echo -e "\n${GREEN}Installing Dependencies:${RESET_COLOR}"
  npm i

  echo -e "\n${GREEN}All ready!${RESET_COLOR}"
}
