/**
 * Point HOME at a throwaway folder and clear every variable that sends Claude Code, and so the
 * scan, to a data folder or a sign-in. tests/test-isolation.test.ts checks it with its own list.
 */
export function isolateEnvironment(home: string): void {
  for (const name of [
    "CLAUDE_CONFIG_DIR",
    "CLAUDE_SECURESTORAGE_CONFIG_DIR",
    "XDG_CONFIG_HOME",
    "APPDATA",
    "LOCALAPPDATA",
    "ANTHROPIC_CONFIG_DIR",
    "ANTHROPIC_PROFILE",
  ]) {
    delete process.env[name];
  }
  process.env.HOME = home;
  process.env.USERPROFILE = home;
}
