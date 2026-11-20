#!/usr/bin/env python3
"""validate-config.py — Validate playwright.config.ts for common issues.

Usage: python validate-config.py [path/to/playwright.config.ts]

Exit codes:
    0 = valid
    1 = issues found
    2 = file not found
"""

import sys
import re

def validate(content: str) -> tuple[list[str], list[str]]:
    errors = []
    warnings = []

    # Check defineConfig usage
    if "defineConfig" not in content:
        warnings.append("Not using defineConfig() — consider wrapping config for type safety")

    # Check testDir
    if "testDir" not in content:
        warnings.append("No testDir specified — defaults to '.' which runs all .spec files")

    # Check timeout
    if "timeout" not in content:
        warnings.append("No timeout configured — defaults to 30s")

    # Check for waitForTimeout (anti-pattern)
    if "waitForTimeout" in content:
        errors.append("Found 'waitForTimeout' in config — this is an anti-pattern. Use web-first assertions")

    # Check retries for CI
    if "retries" not in content:
        warnings.append("No retries configured — consider retries: process.env.CI ? 2 : 0")

    # Check projects
    if "projects" not in content:
        warnings.append("No projects defined — tests will only run on default browser")

    # Check for trace
    if "trace" not in content:
        warnings.append("No trace configured — consider trace: 'on-first-retry' for debugging")

    # Check reporter
    if "reporter" not in content:
        warnings.append("No reporter configured — consider [['html'], ['list']]")

    # Check for baseURL
    if "baseURL" not in content:
        warnings.append("No baseURL — tests will need full URLs in page.goto()")

    # Check for webServer
    if "webServer" not in content:
        warnings.append("No webServer — app must be running before tests start")

    return errors, warnings


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "playwright.config.ts"

    try:
        with open(path) as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ File not found: {path}")
        sys.exit(2)

    errors, warnings = validate(content)

    if warnings:
        print(f"⚠️  {len(warnings)} warning(s):")
        for w in warnings:
            print(f"   • {w}")

    if errors:
        print(f"\n❌ {len(errors)} error(s):")
        for e in errors:
            print(f"   • {e}")
        sys.exit(1)
    else:
        print(f"\n✅ Config is valid ({len(warnings)} warning(s))")
        sys.exit(0)


if __name__ == "__main__":
    main()
