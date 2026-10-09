# DATTA Publishing Studio

Public site: https://boggiomichael.github.io/datta/

Private studio: https://datta-publishing-studio.mikebojio.chatgpt.site

The public website keeps its static React/Markdown build, English/Hebrew routes, fonts and GitHub Pages hosting. The studio is a small Git-backed CMS built around Tiptap. It runs separately on Sites with managed ChatGPT sign-in, owner-only access, D1 private drafts and R2 private media. Its source is in `studio/`; it is not part of the public Pages build.

## First connection

1. Open the studio and sign in with the ChatGPT account that owns the Site.
2. In **Connections**, choose **Connect GitHub App**. Register the private app and install it on **only boggioMichael/datta**. The app requests Contents, Pull requests and Issues write access; Checks and Actions read access. It does not need organization, account administration, or repository secrets access. A fine-grained token with the same repository permissions is an alternative.
3. Enter each provider's API key and model ID in the private connection form. OpenAI, Gemini, Anthropic and xAI are independent connections. Model availability follows your provider account; entering a key does not prove its quota or model access. A first successful writing request verifies that connection.

Keys are encrypted using AES-GCM with a runtime `VAULT_KEY`. Neither credentials nor drafts are committed to GitHub. Do not put secrets in document bodies, exported files, comments or source changes. Preserve the existing runtime encryption key when redeploying; changing it without migrating the vault makes saved connections unreadable.

## Writing and publishing

- Start a new piece or import an entry from Published library. Import keeps all original metadata and both language bodies.
- Switch EN/עברית to edit independently. Text supports Unicode and RTL. Missing Hebrew stays missing; no translation is silently invented.
- Tiptap supports headings, lists, links, tables, images and formatting. Markdown, HTML and JSON export/import provide portability. Existing DATTA custom components remain in source mode so an editor conversion cannot erase them.
- Add diagrams using Mermaid fenced blocks and equations using `math` or `latex` fenced blocks. Preview renders both. The public renderer supports the same fences.
- Save a private draft. Previous saves appear under Versions. An optimistic version check prevents an older tab from overwriting a newer save. Media stays private until publication.
- Publish creates a branch and pull request containing the two language files, preserved metadata and referenced new images. Both languages are committed atomically. Changes on GitHub since import cause a conflict instead of an overwrite.
- **Check & release** merges only after the `validate` check succeeds for that exact commit. GitHub Pages then performs its own checks and deployment. A merge is not itself proof of a finished deployment; inspect the Pages workflow if necessary.
- Failed or uncertain writes are not automatically replayed. Inspect Activity and the GitHub PR before retrying. Refresh/import the published piece after release before starting a further edit.

Drafts belong in the studio. `publication: draft` is also excluded from the static content model, search and sitemap, but putting a draft in this public repository still makes its source public.

## AI helper

Choose a connected provider. Suggestions mode can read website source/content but does not mutate the workspace. Enable requested workspace actions to let the helper save draft text, prepare a checked publication or create source-change pull requests. A source-change PR needs review and merge on GitHub; it cannot bypass the deployment checks.

The helper receives the current saved document and text files it requests. It cannot retrieve API keys or execute arbitrary infrastructure/shell commands. Content is treated as untrusted reference material. It can help with research questions and source analysis, but this version does not include a live web search tool and must not claim it verified external citations.

Collaborator communication uses an explicit Send public comment action on a datta issue/PR. Messages are public because this repository is public. AI text can be copied into the message field for review. This is an asynchronous editorial workflow, not simultaneous cursor collaboration.

## Game

Counterpoint lives at `/en/play/` and `/he/play/`. It is an original 2048-inspired implementation with musical merge sounds, undo, hints, a bot and duet mode. The local expected-value bot works without credentials or network calls. Its behavior is algorithmic, not a claim of connection to any paid AI provider. Progress stays in the visitor's browser; there is no server leaderboard or tracking.

## Operations

Public validation: `npm ci`, `npm run check`, `npm test`, `npm run validate`.

Studio validation: `cd studio`, `npm ci`, `npm run check`, `npm test`, `npm run build`. `node tests/integration.mjs` tests the local preview at port 5173, including auth, CSRF, persistence and conflicts; it creates local-only fixtures.

Sites publication uses the installed Sites workflow and `.openai/hosting.json` project ID. The source helper commits/pushes the exact studio source and packages the built Worker. D1 migrations under `drizzle/` must be kept immutable once applied. Local `.wrangler/`, `.env*`, `.dev.vars*`, `node_modules/` and `.sites-runtime/` are ignored.

The studio is owner-private. Do not make it public to share a preview. To collaborate privately across separate user accounts, add and test an explicit membership system before broadening the audience.

Rollback the public site by reverting the offending Git commit and allowing Pages to redeploy. Private draft history remains independent. Backup important drafts using JSON/Markdown exports and the platform's database/storage backup controls.

## Documentation references

- Tiptap Markdown: https://tiptap.dev/docs/editor/markdown
- GitHub App manifest flow: https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
- OpenAI function calling: https://developers.openai.com/api/docs/guides/function-calling
- Gemini OpenAI compatibility: https://ai.google.dev/gemini-api/docs/openai
- Anthropic Messages API: https://platform.claude.com/docs/en/api/messages
- xAI API: https://docs.x.ai/developers/rest-api-reference/inference/responses
