# How this project goes live

**Product:** Super Street Fighter 2 Soundboard (plain website, no database)
**Repo:** https://github.com/Don-BP/super-street-fighter-2-soundboard (public, GitHub account `Don-BP`)
**Host:** GitHub Pages, source = `main` branch, root folder
**Live URL:** https://don-bp.github.io/super-street-fighter-2-soundboard/

## Steps
1. No build step. Pre-flight = open `index.html` and check the sounds play; scan the staged diff for secrets (there should be no `.env` files).
2. Commit and push to `main`. No pull requests — push directly.
3. Wait for the GitHub Pages build to finish (`gh api repos/Don-BP/super-street-fighter-2-soundboard/pages/builds/latest`, status must be `built`).
4. Load the live URL and confirm something from this change is actually on the page.

## Database
None.

## Project extras
None. If a new feature adds sound files, check they load on the live site, not just locally.
