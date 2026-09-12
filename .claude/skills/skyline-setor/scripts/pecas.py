# -*- coding: utf-8 -*-
"""O catálogo das peças: o que é pintável, e como semear cada uma.

Fica separado dos scripts de propósito. Regra de aeronave é dado, não código — e
quando o dado está no meio do algoritmo, ninguém acha para corrigir.
"""
import os

RAIZ = '/home/user/Clone/public/sprites'

# ---------------------------------------------------------------- aeronaves

def sprites():
    """Todos os sprites do jogo: os de passageiro e os cargueiros/outsize."""
    out = []
    for pasta in ('aircraft', 'freighters'):
        d = os.path.join(RAIZ, pasta)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith('.png'):
                out.append((f[:-4], os.path.join(d, f)))
    return out


# Aeronaves de hélice. A lista muda a regra do que é pintável no motor: em
# turboélice a nacela **inteira** leva a pintura da companhia, porque não há
# reversor de empuxo exposto para deixar em metal. Em turbofan só o capô do fan.
TURBOELICE = {'atr42', 'atr72', 'atr72f', 'q400'}


def por_helice(aid):
    return aid in TURBOELICE


# ---------------------------------------------------------------- peças

# Cada peça diz: a pasta de destino, o texto para o Grounding DINO, e de onde
# sai a semente do SAM. `fracao` só é usada quando a linha de painel não aparece
# na foto — é o último recurso, não a regra.
PECAS = {
    'motor': dict(
        pasta='enginemasks',
        texto='an aircraft jet engine nacelle. a turboprop engine nacelle. an engine cowling.',
        # o capô pintável do turbofan acaba na divisa de painel do reversor;
        # no turboélice a nacela inteira é pintável
        recorta_capo=True,
        fracao=0.58,
    ),
    'helice': dict(
        pasta='propmasks',
        texto='a propeller blade. an aircraft propeller. a spinner cone.',
        recorta_capo=False,
    ),
    'asa': dict(
        pasta='wingmasks',
        texto='an aircraft wing. a wing seen from the side.',
        recorta_capo=False,
    ),
    'deriva': dict(
        pasta='tailmasks',
        texto='the vertical stabilizer of an aircraft. an aircraft tail fin.',
        recorta_capo=False,
    ),
    'trem': dict(
        pasta='gearmasks',
        texto='an aircraft landing gear. a landing gear wheel and strut.',
        recorta_capo=False,
    ),
    'fuselagem': dict(
        pasta='fuselagemasks',
        texto='the fuselage tube of an airliner. the body of an aircraft.',
        recorta_capo=False,
    ),
    'janela': dict(
        pasta='windowmasks',
        texto='the row of passenger windows on an airliner.',
        recorta_capo=False,
    ),
    'cabine': dict(
        pasta='cockpitmasks',
        texto='the cockpit windshield of an aircraft.',
        recorta_capo=False,
    ),
    'winglet': dict(
        pasta='wingletmasks',
        texto='a winglet at the tip of an aircraft wing.',
        recorta_capo=False,
        # ver SKILL.md: em vista lateral pura o winglet fica dentro da silhueta
        # da fuselagem e não há fronteira na imagem para achar
        impossivel_em_perfil=True,
    ),
}


def peca(nome):
    if nome not in PECAS:
        raise SystemExit('peça desconhecida: %s. Conhecidas: %s'
                         % (nome, ', '.join(sorted(PECAS))))
    return PECAS[nome]
