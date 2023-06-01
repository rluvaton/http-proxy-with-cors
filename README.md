# NPM package Boilerplate

## Features:

- TypeScript
- Vitest
- ESLint
- Prettier
- Husky
- CommitLint
- CI in GitHub Action
- Auto Deploy to NPM using `semantic-release`

### Auto deploy to NPM

#### Setup

for it to work you need to add to your GitHub secrets the `NPM_TOKEN` variable with the NPM token to publish

#### Removing that feature

If you want to remove that feature you need to delete the `deploy` job from the `.github/workflows/ci.yml` file
