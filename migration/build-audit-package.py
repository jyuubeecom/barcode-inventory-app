"""Build a standalone, offline-only backup audit. No user data is bundled."""
from pathlib import Path
import sys
import zipfile

def build(destination):
    root = Path(__file__).resolve().parent
    html = (root / 'backup-audit.html').read_text()
    for name in ('backup-audit.js', 'backup-audit-ui.js'):
        script = (root / name).read_text().replace('</script', '<\\/script')
        html = html.replace(f'<script src="{name}"></script>', '<script>\n' + script + '\n</script>')
    assert '<script src=' not in html
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('inventory-migration-check.html', html.encode('utf-8'))
        archive.writestr('最初に読む.md', (root / 'README.md').read_bytes())
    return destination

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 build-audit-package.py /absolute/output/package.zip')
    print(build(sys.argv[1]))
