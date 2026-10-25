"""Run a local, project-scoped PostgreSQL server without a system install.

Uses the PostgreSQL binaries bundled in the `pgserver` pip package
(requirements-dev.txt). Data lives in backend/.pgdata (gitignored).
The role, password, port and database names are read from DATABASE_URL and
TEST_DATABASE_URL in backend/.env, so there is a single source of truth.

    python scripts/local_postgres.py init     # create cluster + databases
    python scripts/local_postgres.py start
    python scripts/local_postgres.py stop
    python scripts/local_postgres.py status

If you already have PostgreSQL installed (or use Docker / a hosted
database), you do not need this script: just point DATABASE_URL at it.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parent.parent
PGDATA = BACKEND_DIR / ".pgdata"
LOGFILE = PGDATA / "server.log"


def _bin(name: str) -> str:
    try:
        from pgserver._commands import POSTGRES_BIN_PATH
    except ImportError:
        sys.exit("pgserver is not installed: pip install -r requirements-dev.txt")
    return str(Path(POSTGRES_BIN_PATH) / name)


def _config():
    env = {**dotenv_values(BACKEND_DIR / ".env"), **os.environ}
    if not env.get("DATABASE_URL"):
        sys.exit("DATABASE_URL is not set (copy .env.example to .env first)")
    app_url = make_url(env["DATABASE_URL"])
    test_url = make_url(env["TEST_DATABASE_URL"]) if env.get("TEST_DATABASE_URL") else None
    if app_url.host not in ("127.0.0.1", "localhost"):
        sys.exit("DATABASE_URL does not point at localhost; nothing to manage here")
    for url in filter(None, [app_url, test_url]):
        # Names are interpolated into SQL / CLI arguments below.
        if not re.fullmatch(r"[A-Za-z0-9_]+", url.database or "") or not re.fullmatch(r"[A-Za-z0-9_]+", url.username or ""):
            sys.exit("Database and user names may only contain letters, digits and underscores")
    return app_url, test_url


def _run(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(args, text=True, capture_output=True, **kwargs)


def is_running() -> bool:
    return PGDATA.exists() and _run([_bin("pg_ctl"), "-D", str(PGDATA), "status"]).returncode == 0


def start() -> None:
    app_url, _ = _config()
    if is_running():
        print("PostgreSQL is already running")
        return
    port = app_url.port or 5432
    # Output is not captured: on Windows the postmaster inherits pg_ctl's
    # stdout handle, so reading a pipe would block until the server exits.
    result = subprocess.run([
        _bin("pg_ctl"), "-D", str(PGDATA), "-l", str(LOGFILE), "-w",
        "-o", f"-p {port} -c listen_addresses=127.0.0.1", "start",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode != 0:
        sys.exit(f"Failed to start PostgreSQL. See {LOGFILE}")
    print(f"PostgreSQL running on 127.0.0.1:{port} (data: {PGDATA})")


def stop() -> None:
    if not is_running():
        print("PostgreSQL is not running")
        return
    _run([_bin("pg_ctl"), "-D", str(PGDATA), "-w", "stop"])
    print("PostgreSQL stopped")


def init() -> None:
    app_url, test_url = _config()
    if not (PGDATA / "PG_VERSION").exists():
        # The password is passed via a temporary file so it never appears in
        # the process list or shell history.
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".pw") as pw:
            pw.write(app_url.password or "")
        try:
            result = _run([
                _bin("initdb"), "-D", str(PGDATA), "-U", app_url.username,
                f"--pwfile={pw.name}", "--auth=scram-sha-256", "--encoding=UTF8",
                "--locale=C",
            ])
        finally:
            os.unlink(pw.name)
        if result.returncode != 0:
            sys.exit(f"initdb failed:\n{result.stdout}{result.stderr}")
        print(f"Initialised cluster in {PGDATA}")
    start()

    env = {**os.environ, "PGPASSWORD": app_url.password or ""}
    for url in filter(None, [app_url, test_url]):
        exists = _run([
            _bin("psql"), "-h", "127.0.0.1", "-p", str(app_url.port or 5432),
            "-U", app_url.username, "-d", "postgres", "-tAc",
            f"SELECT 1 FROM pg_database WHERE datname = '{url.database}'",
        ], env=env)
        if exists.stdout.strip() == "1":
            print(f"Database {url.database} already exists")
            continue
        result = _run([
            _bin("createdb"), "-h", "127.0.0.1", "-p", str(app_url.port or 5432),
            "-U", app_url.username, url.database,
        ], env=env)
        if result.returncode != 0:
            sys.exit(f"createdb {url.database} failed:\n{result.stderr}")
        print(f"Created database {url.database}")


COMMANDS = {"init": init, "start": start, "stop": stop,
            "status": lambda: print("running" if is_running() else "stopped")}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        sys.exit(f"usage: python scripts/local_postgres.py [{'|'.join(COMMANDS)}]")
    COMMANDS[sys.argv[1]]()
