import base64
import gzip
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FRONTEND_FILES = [
    (
        ROOT / "frontend" / "package.json",
        "/srv/dll347/frontend/package.json",
    ),
    (
        ROOT / "frontend" / "public" / "version.json",
        "/srv/dll347/frontend/public/version.json",
    ),
    (
        ROOT / "frontend" / "src" / "app" / "globals.css",
        "/srv/dll347/frontend/src/app/globals.css",
    ),
    (
        ROOT / "frontend" / "src" / "app" / "layout.tsx",
        "/srv/dll347/frontend/src/app/layout.tsx",
    ),
    (
        ROOT / "frontend" / "src" / "lib" / "api.ts",
        "/srv/dll347/frontend/src/lib/api.ts",
    ),
    (
        ROOT / "frontend" / "src" / "components" / "edit-activity-modal.tsx",
        "/srv/dll347/frontend/src/components/edit-activity-modal.tsx",
    ),
    (
        ROOT / "frontend" / "src" / "components" / "dashboard-screen.tsx",
        "/srv/dll347/frontend/src/components/dashboard-screen.tsx",
    ),
    (
        ROOT / "frontend" / "src" / "components" / "member-dashboard-screen.tsx",
        "/srv/dll347/frontend/src/components/member-dashboard-screen.tsx",
    ),
]

SSH_HOST = "ubuntu@51.75.77.80"

def run_ssh(cmd: str) -> str:
    full_cmd = ["ssh", "-o", "ConnectTimeout=20", SSH_HOST, cmd]
    print(f"Running remote command: {cmd[:80]}...")
    res = subprocess.run(full_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"ERROR: {res.stderr}", file=sys.stderr)
        raise RuntimeError(f"Remote command failed with exit code {res.returncode}: {res.stderr}")
    return res.stdout.strip()

def deploy_file(local_path: Path, remote_path: str):
    print(f"Deploying {local_path.name} -> {remote_path}...")
    content = local_path.read_bytes()
    compressed = gzip.compress(content)
    b64_str = base64.b64encode(compressed).decode("ascii")

    script = f"python3 -c \"import base64, gzip, os; os.makedirs(os.path.dirname('{remote_path}'), exist_ok=True); open('{remote_path}', 'wb').write(gzip.decompress(base64.b64decode('{b64_str}')))\""
    res = subprocess.run(["ssh", "-o", "ConnectTimeout=20", SSH_HOST, script], capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Deploying {local_path.name} failed: {res.stderr}")

    remote_size = run_ssh(f"wc -c < '{remote_path}'")
    if int(remote_size) != len(content):
        raise ValueError(f"Size mismatch on {remote_path}: expected {len(content)}, got {remote_size}")
    print(f"  Verified {local_path.name} ({remote_size} bytes)")

def main():
    print("=== Starting DLL347 Frontend Patch Deployment ===")

    for local_path, remote_path in FRONTEND_FILES:
        deploy_file(local_path, remote_path)

    print("\nEnsuring production environment settings on remote...")
    run_ssh("sudo rm -f /srv/dll347/frontend/.env.local /srv/dll347/frontend/.env*.local")
    run_ssh("test -f /srv/dll347/frontend/.env.production || echo 'NEXT_PUBLIC_API_BASE_URL=/api' | sudo tee /srv/dll347/frontend/.env.production > /dev/null")

    print("\nBuilding frontend on production...")
    out_build = run_ssh("cd /srv/dll347/frontend && npm run build")
    print(out_build)

    print("\nVerifying production build guardrails...")
    guardrail_check = run_ssh("grep -r '127.0.0.1:8000' /srv/dll347/frontend/.next/static/ || true")
    if "127.0.0.1:8000" in guardrail_check:
        raise RuntimeError("CRITICAL ERROR: Found 127.0.0.1:8000 baked into client static bundle! Aborting.")

    print("\nRestarting dll347-frontend service...")
    run_ssh("sudo systemctl restart dll347-frontend.service")
    status = run_ssh("systemctl is-active dll347-frontend.service")
    print(f"Service status: {status}")
    if status != "active":
        raise RuntimeError("Frontend service failed to become active!")

    print("\n=== Frontend deployment completed successfully! ===")

if __name__ == "__main__":
    main()
