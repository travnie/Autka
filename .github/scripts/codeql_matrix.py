"""Select PR CodeQL languages; full scans on main, schedule and fallback."""

import json
import os
from pathlib import PurePosixPath
import subprocess

ROWS = (("actions","none","ubuntu-latest"),("javascript-typescript","none","ubuntu-latest"),("java-kotlin","manual","ubuntu-latest"),("swift","manual","macos-15"))
ALL = {row[0] for row in ROWS}


def select(paths):
    selected = set()
    for path in paths:
        if path.startswith((".github/codeql/", ".github/scripts/")) or path == ".github/workflows/codeql.yml":
            return ALL
        if path.startswith(".github/actions/"):
            return ALL
        if path.startswith(".github/workflows/"):
            selected.add("actions")
            continue
        if PurePosixPath(path).suffix.lower() in {".md", ".mdx"}:
            continue
        if path.startswith("backend/"):
            selected.add("javascript-typescript")
        elif path.startswith("iosApp/"):
            selected.add("swift")
        elif path.startswith("app/"):
            selected.add("java-kotlin")
        elif path.startswith("shared/") or path.startswith("gradle/") or path in {
            "build.gradle.kts", "settings.gradle.kts", "gradle.properties", "gradlew", "gradlew.bat"
        }:
            selected.update(("java-kotlin", "swift"))
        else:
            return ALL
    return selected


def plan(event, base_sha):
    if event != "pull_request":
        return ALL
    # Synthetic PR merge: current base is first parent.
    for base in ("HEAD^1", base_sha):
        if not base:
            continue
        try:
            result = subprocess.run(
                ["git", "diff", "--name-only", "--no-renames", "-z", base, "HEAD"],
                check=True, capture_output=True,
            )
            return select(os.fsdecode(p) for p in result.stdout.split(b"\0") if p)
        except subprocess.CalledProcessError:
            continue
    return ALL


def matrix(selected):
    return [
        dict(zip(("language", "build-mode", "runner"), row))
        for row in ROWS if row[0] in selected
    ]


if __name__ == "__main__":
    print("include=" + json.dumps(matrix(plan(os.getenv("EVENT_NAME"), os.getenv("BASE_SHA"))), separators=(",", ":")))
