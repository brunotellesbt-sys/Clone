"""Importa apenas recursos gráficos do ZIP indicado; nunca executa o código extraído.

Uso: python scripts/import-aircraft2d.py 'Sistema Aeronaves 2D.zip'
Requer Pillow. Mantém o canvas e os bytes originais de cada camada.
"""
import argparse
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'aircraft2d'

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    models, library, inventory, hashes = {}, [], [], {}
    OUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.archive) as archive:
        for info in archive.infolist():
            parts = info.filename.split('/')
            if info.is_dir() or len(parts) < 3 or not re.match(r'0[1-6]_', parts[1]):
                continue
            suffix = Path(parts[-1]).suffix.lower()
            if suffix not in {'.webp', '.png', '.jpg', '.jpeg', '.otf', '.ttf', '.svg'}:
                continue
            data = archive.read(info)
            digest = hashlib.sha256(data).hexdigest()
            # Duplicatas de motores/sprites são referenciadas, sem triplicar arquivos.
            dest = hashes.setdefault(digest, 'assets/' + digest[:24] + suffix)
            path = OUT / dest
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_bytes(data)
            size, bbox = [0, 0], None
            if suffix not in {'.otf', '.ttf', '.svg'}:
                with Image.open(io.BytesIO(data)) as im:
                    size = list(im.size)
                    bbox = im.convert('RGBA').getchannel('A').getbbox()
            inventory.append({'source': info.filename, 'file': dest, 'sha256': digest, 'bytes': len(data)})
            if parts[1].startswith(('01_', '02_')):
                match = re.fullmatch(r'assets_(?:resized|small)_aircraft_layer_pngs_(.+?)_((?:options_(?:[a-z]+_)?)?)(\d+)_(.+)\.webp', parts[-1])
                if not match:
                    raise ValueError('Camada sem interpretação: ' + info.filename)
                source, variant, order, name = match.groups()
                model = models.setdefault(source, {'id': source, 'name': parts[2].replace('_', ' '), 'layers': {}})
                layer_id = variant + order + '_' + name
                layer = model['layers'].setdefault(layer_id, {'id': layer_id, 'order': int(order), 'name': name, 'variant': variant.replace('options_', '').strip('_'), 'option': bool(variant)})
                if parts[1].startswith('01_'):
                    layer.update({'file': dest, 'size': size, 'box': bbox})
                else:
                    layer['small'] = dest
            else:
                library.append({'id': parts[-1], 'file': dest, 'category': '/'.join(parts[1:-1]), 'size': size})
    for model in models.values():
        model['layers'] = sorted(model['layers'].values(), key=lambda x: (x['order'], x['id']))
        body = next(x for x in model['layers'] if x['name'] == 'fuselage')
        tail = next(x for x in model['layers'] if x['name'] == 'tail')
        model['size'], model['bodyBox'], model['tailBox'] = body['size'], list(body['box']), tail['box']
        # Q300/Q400 trazem pixels da deriva na máscara da fuselagem. Mede a
        # altura do tubo numa seção à frente da asa para posicionar o letreiro.
        with Image.open(OUT / body['file']) as im:
            left, top, right, bottom = body['box']
            section = im.convert('RGBA').getchannel('A').crop((int(left + (right-left)*.25), 0, int(left + (right-left)*.4), im.height)).getbbox()
            if section:
                model['bodyBox'] = [left, section[1], right, section[3]]
        # Os desenhos decorativos ficam entre a base da cauda/fuselagem e os detalhes.
        # Caixa alfa serve para recorte do letreiro; nenhum pixel é redimensionado.
        for layer in model['layers']:
            layer['pattern'] = bool(not layer['option'] and re.match(r'^(de_|hu_|oz_|nh_|sq_|tui_|cz_|ci_|br_|triangle_|wavy_|swoosh(?:_|$)|curve_|thick_|light_|double_|thin_)', layer['name']))
            layer['sector'] = 'tail' if layer['order'] < body['order'] else 'fuselage'
        write_json(OUT / 'models' / (model['id'] + '.json'), model)
    write_json(OUT / 'models.json', [{'id': m['id'], 'name': m['name']} for m in models.values()])
    # Mesma imagem em categorias diferentes continua localizável pelo nome original.
    unique = {item['id']: item for item in library}
    write_json(OUT / 'library.json', list(unique.values()))
    report = {'archive': args.archive.name, 'sha256': hashlib.sha256(args.archive.read_bytes()).hexdigest(),
              'sourceFiles': len(inventory), 'uniqueAssets': len(hashes), 'models': len(models),
              'libraryItems': len(unique), 'entries': inventory}
    write_json(OUT / 'inventory.json', report)
    print(json.dumps({k: v for k, v in report.items() if k != 'entries'}, ensure_ascii=False))

if __name__ == '__main__':
    main()
