# Claude Code Context

Notes for Claude when working on this project.

## Important: Do Not Over-Engineer

**Only make changes that are explicitly requested.**

- Do NOT change button appearances, colors, or styling unless asked
- Do NOT make headers sticky or add UI behaviors that weren't requested
- Do NOT refactor or "improve" code that isn't part of the task
- Do NOT add features, animations, or enhancements beyond what was asked
- Keep changes minimal and focused on the specific request

## Deployment

**Backend is deployed on Render, not localhost.**

- The iOS app connects to the Render-hosted backend, not localhost
- Changes to backend code or story JSON files must be pushed to GitHub to take effect
- Render auto-deploys on push to main branch
- Do NOT start a local backend server unless explicitly asked for local testing

## Key Files

- `app/Config/APIConfig.swift` - Contains the backend URL (Render URL, not localhost)
- `backend/app/data/stories/*.json` - Story content files
- `backend/app/static/` - Audio and image files served via CDN

## Common Gotchas

1. **Story changes not appearing**: Push to GitHub, wait for Render deploy, then pull-to-refresh in app
2. **Premium toggle not visible**: Only shows in DEBUG builds (run from Xcode, not TestFlight)
3. **Images not loading**: Check URL resolution in StoryCard.swift and ReaderView.swift
4. **Cache issues**: Pull-to-refresh clears cache after successful response

## Testing Premium

1. Push code with `isPremium: true` in story JSONs
2. Wait for Render deploy
3. Pull to refresh in app
4. 5 stories should show lock overlay (one per JLPT level)
5. Use Developer section in Settings to toggle premium (DEBUG only)
