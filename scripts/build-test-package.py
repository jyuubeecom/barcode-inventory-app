"""Create a static test ZIP with a separate inventory database. No network access."""
from pathlib import Path
import sys
import zipfile


def build(destination):
    root = Path(__file__).resolve().parent.parent
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(root.glob('*.js')) + [root / n for n in ('index.html', 'style.css', 'manifest.json')]
    files += [root / 'migration/backup-audit.js', root / 'migration/prepare-products.js']
    for folder in ('icons', 'libs'):
        files += sorted(p for p in (root / folder).rglob('*') if p.is_file())
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            name = file.relative_to(root).as_posix()
            data = file.read_bytes()
            if name == 'storage.js':
                old = b'"barcodeInventoryDatabase"'
                assert data.count(old) == 1, 'Database declaration changed; review isolation before packaging.'
                data = data.replace(old, b'"barcodeInventoryDatabase-test-v29311"')
            elif name == 'index.html':
                text = data.decode('utf-8')
                assert '画面版 v293.14' in text
                text = text.replace('画面版 v293.14', '検証専用・画面版 v293.14')
                text = text.replace('<title>', '<title>【検証用】', 1)
                data = text.encode('utf-8')
            elif name == 'manifest.json':
                import json
                manifest = json.loads(data)
                manifest['name'] = '【検証用】バーコード在庫・棚卸管理 v293.11'
                manifest['short_name'] = '在庫テスト29311'
                # Keep this identity stable across test builds, and distinct from
                # the production app even if both manifests share a directory.
                # This does not override Chrome's handling of a legacy app with
                # a broader scope; coexistence still needs an Android check.
                manifest['id'] = './?app=barcode-inventory-test-v29311'
                data = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
            archive.writestr(name, data)
    return destination


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 scripts/build-test-package.py /absolute/output/test.zip')
    print(build(sys.argv[1]))
