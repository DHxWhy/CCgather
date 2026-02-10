# Contributing to CCgather

Thanks for your interest in contributing to CCgather! This guide will help you get started.

## Code of Conduct

Be respectful, constructive, and collaborative. We're building a community where Claude Code developers worldwide can gather and celebrate their passion for coding.

## Ways to Contribute

- **Report bugs** - Found something broken? Let us know
- **Suggest features** - Have ideas for improvements? We'd love to hear them
- **Fix issues** - Check our [issue tracker](https://github.com/DHxWhy/ccgather/issues)
- **Improve docs** - Documentation improvements are always welcome
- **Add translations** - Help make CCgather accessible to more developers
- **Improve UI/UX** - Help us make the interface more beautiful and intuitive

## Getting Started

### Prerequisites

- **Node.js 18.17.0+** - Required for development
- **pnpm** - Package manager (install with `npm install -g pnpm`)
- **Supabase account** - For database access
- **Clerk account** - For authentication

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/ccgather.git
cd ccgather
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Create `.env.local`:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Gemini (for AI translation)
GEMINI_API_KEY=your_gemini_api_key

# Web Push (optional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

4. **Start development server**

```bash
pnpm dev
```

5. **Open the app**

Navigate to `http://localhost:3000`

### Project Structure

```
ccgather/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Authentication pages
│   ├── (main)/                 # Main app pages
│   ├── api/                    # API routes
│   └── layout.tsx              # Root layout
├── components/                 # React components
│   ├── leaderboard/            # Leaderboard components
│   ├── community/              # Community features
│   ├── profile/                # User profile
│   └── ui/                     # Reusable UI components
├── hooks/                      # Custom React hooks
├── lib/                        # Utilities and helpers
│   ├── supabase/               # Supabase client
│   ├── clerk/                  # Clerk utilities
│   └── utils.ts                # General utilities
├── packages/                   # Monorepo packages
│   └── cli/                    # CCgather CLI
├── public/                     # Static assets
├── supabase/                   # Supabase migrations
├── tests/                      # Playwright tests
└── worker/                     # Service worker for PWA
```

## Development Workflow

### 1. Create a feature branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make your changes

- Write clear, focused commits
- Follow existing code style
- Add tests for new features
- Update documentation if needed

### 3. Run tests and checks

```bash
# Lint check
pnpm lint

# Format check
pnpm format:check

# Fix formatting
pnpm format

# Type check
pnpm build

# Run tests (if applicable)
pnpm test
```

### 4. Commit your changes

```bash
git add .
git commit -m "feat: add support for X"
# or
git commit -m "fix: resolve issue with Y"
```

Use conventional commit format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - UI/styling changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 5. Push and create a Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a PR on GitHub with:
- Clear description of what changed and why
- Reference any related issues (`Fixes #123`)
- Screenshots/videos for UI changes
- Test results if applicable

## Common Tasks

### Adding a New Feature

1. **Plan the feature** - Discuss in issues first
2. **Update database schema** - Add migrations in `supabase/migrations/`
3. **Create API routes** - Add routes in `app/api/`
4. **Build UI components** - Create components in `components/`
5. **Add translations** - Update translation keys if needed
6. **Test thoroughly** - Test all user flows

### Fixing a Bug

1. **Reproduce the issue** - Verify you can reproduce it
2. **Identify the cause** - Debug to find the root cause
3. **Fix the bug** - Make the necessary changes
4. **Test** - Verify the fix works
5. **Check for regressions** - Ensure nothing else broke

### Improving UI/UX

1. **Identify the improvement** - What needs to be better?
2. **Design the solution** - Sketch or mockup if needed
3. **Implement** - Update components and styles
4. **Test responsiveness** - Check mobile, tablet, desktop
5. **Get feedback** - Share screenshots in PR

## Code Style Guidelines

### TypeScript

- Use explicit types for function parameters and return values
- Prefer `interface` over `type` for object shapes
- Use `const` by default, `let` only when reassignment is needed
- Avoid `any` - use `unknown` or proper types

### React

- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use TypeScript for props

### Styling

- Use Tailwind CSS utility classes
- Follow existing spacing and color patterns
- Ensure responsive design (mobile-first)
- Test in light and dark modes

### File Naming

- Components: `PascalCase.tsx` (e.g., `LeaderboardTable.tsx`)
- Utilities: `kebab-case.ts` (e.g., `format-tokens.ts`)
- API routes: `route.ts` (Next.js convention)

## Pull Request Guidelines

### Before Submitting

- [ ] Code builds without errors (`pnpm build`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Formatting is correct (`pnpm format:check`)
- [ ] Changes are tested manually
- [ ] Documentation is updated if needed
- [ ] Commit messages follow conventional format
- [ ] PR description explains what and why
- [ ] Screenshots/videos included for UI changes

### PR Title Format

Use conventional commit format:
```
feat(leaderboard): add country league filtering
fix(community): resolve translation issue
docs: improve setup instructions
style(profile): update badge display layout
```

### Review Process

1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, a maintainer will merge

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5.9** - Type safety
- **Tailwind CSS 4** - Styling
- **Framer Motion** - Animations

### Backend
- **Supabase** - PostgreSQL database
- **Clerk** - Authentication
- **Google Gemini** - AI translation

### UI Components
- **Radix UI** - Accessible primitives
- **Lucide React** - Icons
- **Recharts** - Charts
- **Cobe** - 3D globe

### Tools
- **TanStack Query** - Data fetching
- **Playwright** - E2E testing
- **ESLint** - Linting
- **Prettier** - Formatting
- **Husky** - Git hooks

## Testing

### Manual Testing

1. **Test all user flows** - Sign up, submit data, view leaderboard, etc.
2. **Test responsiveness** - Mobile, tablet, desktop
3. **Test themes** - Light and dark modes
4. **Test browsers** - Chrome, Firefox, Safari, Edge
5. **Test PWA** - Install and test notifications

### E2E Testing (Playwright)

```bash
# Run tests
pnpm test:e2e

# Run tests in UI mode
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug
```

## Database Migrations

When adding new features that require database changes:

1. **Create migration file** in `supabase/migrations/`
2. **Test locally** with Supabase CLI
3. **Document changes** in PR description
4. **Coordinate with maintainers** for production deployment

## Getting Help

- **GitHub Issues** - [Report bugs or request features](https://github.com/DHxWhy/ccgather/issues)
- **GitHub Discussions** - [Ask questions or share ideas](https://github.com/DHxWhy/ccgather/discussions)
- **Website** - [ccgather.com](https://ccgather.com)

## License

By contributing to CCgather, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to CCgather! 🚀

**Record. Track. Grow.**
