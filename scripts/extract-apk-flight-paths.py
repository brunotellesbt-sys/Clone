"""Read the user's APK ZIP databases as data, never execute APK code."""
import gzip, hashlib, json, math, sqlite3, zipfile
from pathlib import Path
import sys

source, output = Path(sys.argv[1]), Path(sys.argv[2])
data = {}

def runway_length_feet(runway):
    """Some APK rows store the length as NaN; derive it from the endpoints."""
    if math.isfinite(float(runway[-1])):
        return runway
    lat1, lon1, lat2, lon2 = map(float, runway[2:6])
    radius_feet = 20_902_900.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    arc = 2 * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))
    return [*runway[:6], round(radius_feet * arc, 1)]

def finite_json(value):
    if isinstance(value, list):
        return [finite_json(item) for item in value]
    if isinstance(value, dict):
        return {key: finite_json(item) for key, item in value.items()}
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value

with zipfile.ZipFile(source) as archive:
    for suffix, table in [('assets_files_runway_data_260410db.gz', 'runway_data'),
                          ('assets_files_procedure_data_260410db.gz', 'procedures')]:
        names = [n for n in archive.namelist() if n.endswith(suffix)]
        assert len(names) == 1
        db = sqlite3.connect(':memory:')
        db.deserialize(gzip.decompress(archive.read(names[0])))
        if table == 'runway_data':
            for iata, runways, configs, slots in db.execute('SELECT * FROM runway_data'):
                parsed_runways = [runway_length_feet(runway) for runway in json.loads(runways)]
                # Exporta somente a geometria usada pelo mapa: cabeceiras,
                # configurações de pista e procedimentos SID/APP. Os slots e
                # demais dados operacionais do APK não entram no jogo novo.
                data[iata] = dict(runways=parsed_runways, configs=json.loads(configs), procedures=[])
        else:
            for _, iata, kind, name, coords in db.execute('SELECT * FROM procedures'):
                if iata in data and kind in ('SID', 'APP'):
                    data[iata]['procedures'].append(dict(kind=kind, name=name, **finite_json(json.loads(coords))))
        db.close()
output.mkdir(parents=True, exist_ok=True)
for prefix in sorted({key[0] for key in data}):
    (output / f'{prefix}.json').write_text(json.dumps({k:v for k,v in data.items() if k[0]==prefix}, separators=(',',':'), allow_nan=False),encoding='utf-8')
manifest=dict(archiveSha256=hashlib.sha256(source.read_bytes()).hexdigest(), airports=len(data),
              procedures=sum(len(v['procedures']) for v in data.values()), source='The Airline Simulator 1.29.3, supplied apk_contents.zip')
(output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(manifest)
