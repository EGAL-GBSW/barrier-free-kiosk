"""Print the AI server's Python, package, and NVIDIA GPU information."""

import importlib.metadata
import json
import platform
import shutil
import subprocess


def package_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def main() -> None:
    result: dict[str, object] = {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "packages": {
            name: package_version(name)
            for name in ("faster-whisper", "ctranslate2", "fastapi", "uvicorn")
        },
        "nvidia_smi": None,
    }
    if shutil.which("nvidia-smi"):
        process = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        result["nvidia_smi"] = process.stdout.strip() if process.returncode == 0 else process.stderr.strip()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
