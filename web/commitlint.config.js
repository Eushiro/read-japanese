export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // New feature
        "fix",      // Bug fix
        "docs",     // Documentation only
        "style",    // Formatting, no code change
        "refactor", // Code change that neither fixes nor adds
        "perf",     // Performance improvement
        "test",     // Adding tests
        "chore",    // Maintenance tasks
        "revert",   // Revert a commit
        "ci",       // CI/CD changes
        "build",    // Build system changes
      ],
    ],
    "subject-case": [0], // Disable case enforcement
  },
};
