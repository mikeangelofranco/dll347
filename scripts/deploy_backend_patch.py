import base64
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FILES_TO_DEPLOY = [
    (
        ROOT / "backend" / "api" / "profile_alert.py",
        "/srv/dll347/backend/api/profile_alert.py",
    ),
    (
        ROOT / "backend" / "api" / "migrations" / "0035_profilealertwebhookconfig_profilealertwebhooklog.py",
        "/srv/dll347/backend/api/migrations/0035_profilealertwebhookconfig_profilealertwebhooklog.py",
    ),
    (
        ROOT / "backend" / "api" / "models.py",
        "/srv/dll347/backend/api/models.py",
    ),
    (
        ROOT / "backend" / "api" / "admin.py",
        "/srv/dll347/backend/api/admin.py",
    ),
    (
        ROOT / "backend" / "api" / "views.py",
        "/srv/dll347/backend/api/views.py",
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
    b64_str = base64.b64encode(content).decode("ascii")
    
    remote_cmd = (
        f"python3 -c \"import base64, sys; open('{remote_path}', 'wb').write(base64.b64decode(sys.stdin.read().strip()))\" << 'EOF'\n"
        f"{b64_str}\n"
        f"EOF"
    )
    run_ssh(remote_cmd)
    
    # Verify file exists and size matches
    remote_size = run_ssh(f"wc -c < '{remote_path}'")
    if int(remote_size) != len(content):
        raise ValueError(f"Size mismatch on {remote_path}: expected {len(content)}, got {remote_size}")
    print(f"  Verified {local_path.name} ({remote_size} bytes)")

def main():
    print("=== Starting DLL347 Backend Patch Deployment ===")
    
    # 1. Transfer files
    for local_path, remote_path in FILES_TO_DEPLOY:
        deploy_file(local_path, remote_path)
    
    # 2. Run migrations
    print("\nApplying database migrations on production...")
    out_migrate = run_ssh("cd /srv/dll347/backend && ./venv/bin/python manage.py migrate --noinput")
    print(out_migrate)
    
    # 3. Run check
    print("\nRunning Django system checks...")
    out_check = run_ssh("cd /srv/dll347/backend && ./venv/bin/python manage.py check")
    print(out_check)
    
    # 4. Restart backend service
    print("\nRestarting dll347-backend service...")
    run_ssh("sudo systemctl restart dll347-backend.service")
    status = run_ssh("systemctl is-active dll347-backend.service")
    print(f"Service status: {status}")
    if status != "active":
        raise RuntimeError("Service failed to become active!")
        
    print("\n=== Backend deployment completed successfully! ===")

if __name__ == "__main__":
    main()
