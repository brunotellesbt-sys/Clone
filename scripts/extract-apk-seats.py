"""Extract literal seat tables from a hermes-dec disassembly, without running APK code.

Usage: python scripts/extract-apk-seats.py DISASSEMBLY BUNDLE OUTPUT
The supplied APK 1.29.3 uses Hermes 98, data function 671. Only object literals,
object slot assignments and environment stores from its three data blocks are read.
"""
import ast
import hashlib
import json
from pathlib import Path
import re
import sys

source, bundle, destination = map(Path, sys.argv[1:])
text = source.read_text(encoding='utf-8')
point = text.index("'seatProductStats'")
start = text.rfind('=> [Function', 0, point)
end = text.find('=> [Function', point)
section = text[start:end]
assert section.startswith('=> [Function #671 '), 'Unexpected seat data module'

def literal(value):
    value = re.sub(r'\bnull\b', 'None', value)
    value = re.sub(r'\btrue\b', 'True', value)
    value = re.sub(r'\bfalse\b', 'False', value)
    return ast.literal_eval(value)

registers, exported = {}, {}
for line in section.splitlines():
    match = re.match(r'==> ([0-9a-f]+): <([^>]+)>: <([^>]+)>', line)
    if not match:
        continue
    offset, opcode, args = match.groups()
    offset = int(offset, 16)
    if not (0x210 <= offset <= 0x3d6 or 0x43e <= offset <= 0x4fe or 0x772 <= offset <= 0x1e9a):
        continue
    regs = [int(n) for n in re.findall(r'Reg8: (\d+)', args)]
    if opcode.startswith('NewObjectWithBuffer'):
        registers[regs[0]] = literal(line.split('# Object: ', 1)[1])
    elif opcode == 'PutOwnBySlotIdx':
        slot = int(re.search(r'UInt8: (\d+)', args).group(1))
        obj = registers[regs[0]]
        obj[list(obj)[slot]] = registers[regs[1]]
    elif opcode == 'StoreToEnvironment':
        slot = int(re.search(r'UInt8: (\d+)', args).group(1))
        exported[slot] = registers[regs[1]]
    else:
        raise ValueError(f'Unexpected instruction in literal table: {line}')

aircraft = {}
for line in text.splitlines():
    if '# Object: ' not in line or "'aircraft_model':" not in line or "'aircraft_class':" not in line:
        continue
    value = literal(line.split('# Object: ', 1)[1])
    aircraft[value['aircraft_model']] = value['aircraft_class']

result = {
    'source': {'apk': 'The Airline Simulator 1.29.3', 'bundleSha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
               'hermesVersion': 98, 'function': 671},
    'products': exported[0], 'ratings': exported[5], 'aircraftSpecs': exported[11], 'aircraftClasses': aircraft,
}
assert sum(map(len, result['products'].values())) == 28
assert len(result['aircraftSpecs']) == 15
destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f"Extracted 28 seats, 15 cabin families and {len(aircraft)} aircraft mappings to {destination}")
