import { useEffect, useId, useState } from 'react'
import type { AircraftType } from '../game/data/aircraft'
import type { Livery, PieceSize } from '../game/types'
import { artFor, DEFAULT_REGIONS, loadArtManifest, type ArtEntry } from './art'
import { emblemHref } from './emblems'
import { Bandeira } from './Flag'
import { LiveryPlane } from './LiveryPlane'
import {
  bodyMaskHref, cockpitMaskHref, fuseBands, leadingEdgeMaskHref, measure, measured, pieceBox, pieceSpan,
  planeMaskHref, propMaskHref, tailMaskHref, trailingEdgeMaskHref, tyreMaskHref, windowMaskHref, wingMaskHref,
  wingTopMaskHref, wingletMaskHref, type FuseBands, type Measured, type PieceBox,
} from './measure'
import { FONT_STACK, LARGURA_GLIFO } from './silhouette'

interface Props {
  type: AircraftType
  livery: Livery
  titles?: string
  registration?: string
  /**
   * País da primeira matrícula da aeronave, para a bandeira. Vem da aeronave
   * (`Aircraft.cc`), não do hub atual: matrícula não muda de país quando a
   * companhia troca de base.
   */
  flagCC?: string
  className?: string
  /** Motor instalado, quando relevante para a arte (a nacela muda com ele). */
  engineId?: string | null
}

/**
 * Havendo silhueta livre para o modelo, a pintura da companhia é aplicada
 * dentro dela, peça por peça. Sem silhueta — ou se a imagem não carregar —
 * cai no desenho vetorial do próprio jogo.
 */
export function AircraftArt(props: Props) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    loadArtManifest().then(() => setReady(true))
  }, [])
  const entry = ready ? artFor(props.type.id, props.engineId) : undefined
  if (!entry) return <LiveryPlane {...props} />
  return <MaskedArt {...props} entry={entry} />
}

/** Os três degraus do emblema, em fração da caixa segura da deriva. */
const ESCALA_EMBLEMA: Record<PieceSize, number> = { small: 0.6, medium: 0.8, large: 1 }
/** Os três degraus do prefixo, em fração da altura da fuselagem. */
const ESCALA_PREFIXO: Record<PieceSize, number> = { small: 0.11, medium: 0.16, large: 0.22 }

/** Preto de pneu. Não é escolha de livery: nenhuma companhia pinta borracha. */
const BORRACHA = '#15181c'
/** Grafite de pá de hélice, pela mesma razão do pneu: já sai preta da fábrica. */
const HELICE = '#22252b'

const hrefOf = (entry: ArtEntry) =>
  /^https?:\/\//.test(entry.file) ? entry.file : `${import.meta.env.BASE_URL}${entry.file.replace(/^\//, '')}`

function MaskedArt({ type, livery, titles, registration, flagCC, className, entry }: Props & { entry: ArtEntry }) {
  const uid = useId().replace(/:/g, '')
  const href = hrefOf(entry)
  const [box, setBox] = useState<Measured | null | undefined>(() => measured(href))
  const [failed, setFailed] = useState(false)
  const [preciseTail, setPreciseTail] = useState<string | null>(null)
  const [tailBox, setTailBox] = useState<PieceBox | null>(null)
  const [wingBox, setWingBox] = useState<PieceBox | null>(null)
  const [titleSpan, setTitleSpan] = useState<[number, number] | null>(null)
  const [wingletMask, setWingletMask] = useState<string | null>(null)
  const [cockpitMask, setCockpitMask] = useState<string | null>(null)
  const [leMask, setLeMask] = useState<string | null>(null)
  const [topMask, setTopMask] = useState<string | null>(null)
  const [teMask, setTeMask] = useState<string | null>(null)
  const [bands, setBands] = useState<FuseBands | null>(null)
  const [windowMask, setWindowMask] = useState<string | null>(null)
  const [planeMask, setPlaneMask] = useState<string | null>(null)
  const [tyreMask, setTyreMask] = useState<string | null>(null)
  const [propMask, setPropMask] = useState<string | null>(null)
  const [bodyMask, setBodyMask] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    planeMaskHref(entry.file).then((m) => alive && setPlaneMask(m))
    return () => {
      alive = false
    }
  }, [entry.file])

  useEffect(() => {
    let alive = true
    measure(href).then((m) => alive && setBox(m))
    return () => {
      alive = false
    }
  }, [href])

  useEffect(() => {
    let alive = true
    tailMaskHref(type.id).then((m) => {
      if (!alive) return
      setPreciseTail(m)
      // A caixa da deriva sai da máscara dela, não da dedução de measure.ts.
      if (m) pieceBox(m).then((b) => alive && setTailBox(b))
    })
    return () => {
      alive = false
    }
  }, [type.id])

  useEffect(() => {
    let alive = true
    tyreMaskHref(type.id).then((m) => alive && setTyreMask(m))
    propMaskHref(type.id).then((m) => alive && setPropMask(m))
    bodyMaskHref(type.id).then((m) => alive && setBodyMask(m))
    return () => {
      alive = false
    }
  }, [type.id])

  useEffect(() => {
    let alive = true
    // A máscara da asa não pinta mais nada — a chapa fica com a cor da foto —,
    // mas a caixa dela delimita o vão do letreiro. Ver o cálculo mais abaixo.
    wingMaskHref(type.id).then((m) => {
      if (alive && m) pieceBox(m).then((b) => alive && setWingBox(b))
    })
    return () => {
      alive = false
    }
  }, [type.id])

  useEffect(() => {
    let alive = true
    wingletMaskHref(type.id).then((m) => alive && setWingletMask(m))
    cockpitMaskHref(type.id).then((m) => alive && setCockpitMask(m))
    windowMaskHref(type.id).then((m) => alive && setWindowMask(m))
    fuseBands().then((b) => alive && setBands(b[type.id] ?? null))
    leadingEdgeMaskHref(type.id).then((m) => alive && setLeMask(m))
    wingTopMaskHref(type.id).then((m) => alive && setTopMask(m))
    trailingEdgeMaskHref(type.id).then((m) => alive && setTeMask(m))
    return () => {
      alive = false
    }
  }, [type.id])

  /**
   * Onde a faixa de letras cabe inteira dentro do tubo.
   *
   * A medida é da **faixa do texto**, não do dorso todo, e isso é o que faz ela
   * servir: o topo do tubo sobe e desce ao longo do avião, então a interseção
   * de uma faixa alta colapsa no trecho do meio — medido no b737, sobrava uma
   * janela de 16px e o letreiro ia para cima da asa. Com a faixa na altura das
   * letras, o intervalo é o tubo de verdade naquela altura.
   */
  useEffect(() => {
    if (!bodyMask) {
      setTitleSpan(null)
      return
    }
    let alive = true
    const fus = entry.regions?.fuselage ?? box?.fuselage ?? DEFAULT_REGIONS.fuselage
    const crown = bands?.crown ?? fus[0] + 0.42 * (fus[1] - fus[0])
    const dorso = Math.max(0.01, crown - fus[0])
    const alto = Math.min(livery.titleSize * (fus[1] - fus[0]), dorso * 0.86)
    const base = crown - dorso * 0.07
    pieceSpan(bodyMask, Math.max(0, base - alto), base).then((v) => alive && setTitleSpan(v))
    return () => {
      alive = false
    }
  }, [bodyMask, bands, box, entry, livery.titleSize])

  if (failed) {
    return <LiveryPlane type={type} livery={livery} titles={titles} registration={registration} className={className} />
  }

  const { w, h } = entry
  const base = box ?? DEFAULT_REGIONS
  const region = { ...DEFAULT_REGIONS, ...base, ...(entry.regions ?? {}) }
  const [fy0, fy1] = region.fuselage
  // Com máscara de deriva, a caixa e a zona do emblema são as da peça medida;
  // sem ela, as deduzidas em measure.ts.
  const [tx0, ty0, tx1, ty1] = tailBox?.box ?? region.tail
  const emblemZone = tailBox?.emblem ?? region.emblem

  // Zonas da fuselagem em pixels da imagem.
  const bandTop = h * fy0
  const bandBot = h * fy1
  const bandH = Math.max(1, bandBot - bandTop)
  const tailW = w * (tx1 - tx0)

  const bb = entry.regions?.box ?? box?.box ?? [0, 0, 1, 1]
  const planeX0 = bb[0] * w
  const planeW = (bb[2] - bb[0]) * w

  const pad = 0.03
  const view = [
    Math.max(0, bb[0] - pad) * w,
    Math.max(0, bb[1] - pad) * h,
    Math.min(1, bb[2] - bb[0] + pad * 2) * w,
    Math.min(1, bb[3] - bb[1] + pad * 2) * h,
  ]

  const flip = box?.noseLeft === false
  const flipTransform = `translate(${view[0] * 2 + view[2]} 0) scale(-1 1)`

  const bellyY = bandTop + bandH * livery.bellyAt
  const cheatH = Math.max(1, bandH * livery.cheatWidth)
  // A faixa não sobe até a janela.
  //
  // Desenho de faixa (filete, duplo, tríplice, degradê) é coisa de metade de
  // baixo da fuselagem: passando da fileira de janela ele cobre a janela e o
  // letreiro, e o que era listra vira bloco. As formas geométricas — cunha,
  // diagonal, chevron, xadrez, bloco — não entram nessa regra, porque nelas
  // ocupar a fuselagem inteira **é** o desenho.
  const cheatLivre = (['chevron', 'delta', 'diagonal', 'ribbon', 'checker', 'billboard', 'sunray'] as const)
    .includes(livery.cheatStyle as never)
  const cheatTeto = (bands ? h * bands.crown : bandTop + bandH * 0.42) + cheatH / 2
  const cheatMid = cheatLivre
    ? bandTop + bandH * livery.cheatAt
    : Math.max(cheatTeto, bandTop + bandH * livery.cheatAt)
  const noseColor = livery.noseStyle === 'body' ? null : livery.noseStyle === 'dark' ? '#1e293b' : livery.nose

  // O letreiro tem uma caixa, e ele não sai dela.
  //
  // Em cima, o dorso: entre o topo da fuselagem e a fileira de janela, divisa
  // medida por aeronave (fusebands.json). É onde o letreiro fica em qualquer
  // companhia do mundo, e é o que impede letra em cima de janela.
  //
  // Ao longo, do nariz até onde a asa começa (caixa de `wingmasks`). Letra
  // atravessando a asa não existe em avião nenhum, e no jogo ficava pior ainda:
  // a asa é pintada por cima, então o letreiro saía cortado no meio.
  //
  // O tamanho é do jogador — mas a caixa manda. Passou da altura do dorso ou do
  // comprimento disponível, encolhe até caber.
  const crownY = bands ? h * bands.crown : bandTop + bandH * 0.42
  const dorsoH = Math.max(1, crownY - bandTop)
  const titleY = bands ? (bandTop + crownY) / 2 : bandTop + bandH * 0.3

  // Onde a asa começa, contado do nariz em fração do comprimento do avião.
  const asaFrac = wingBox
    ? box?.noseLeft === false
      ? (planeX0 + planeW - wingBox.box[2] * w) / planeW
      : (wingBox.box[0] * w - planeX0) / planeW
    : 0.62

  // E onde o **tubo** comporta a faixa de letras inteira: `titleSpan` mede a
  // interseção das linhas do dorso na máscara de fuselagem, então a letra nunca
  // sai do contorno. Sem essa medida bastava o nariz afinar para a primeira
  // letra passar por fora, e era o que se via.
  const tuboIni = titleSpan
    ? box?.noseLeft === false
      ? (planeX0 + planeW - titleSpan[1] * w) / planeW
      : (titleSpan[0] * w - planeX0) / planeW
    : 0.04
  const tuboFim = titleSpan
    ? box?.noseLeft === false
      ? (planeX0 + planeW - titleSpan[0] * w) / planeW
      : (titleSpan[1] * w - planeX0) / planeW
    : 0.96
  const vaoIni = Math.max(0.02, tuboIni + 0.01)
  const vaoFim = Math.max(vaoIni + 0.1, Math.min(asaFrac - 0.02, tuboFim - 0.01))
  const vao = (vaoFim - vaoIni) * planeW

  const texto = titles ?? ''
  const largura = LARGURA_GLIFO[livery.titleFont]
  const cabe = texto.length ? (vao * 0.98) / (texto.length * largura) : Infinity
  const titleSize = Math.max(8, Math.min(bandH * livery.titleSize, dorsoH * 0.86, cabe))
  const textoW = texto.length * largura * titleSize

  // As âncoras contam a partir do NARIZ, que no arquivo original pode estar
  // à direita — por isso a posição é medida no sentido do avião, não da imagem.
  // O controle de posição desliza o letreiro dentro do vão, e não para fora.
  const folga = Math.max(0, vao - textoW)
  const along = vaoIni + (livery.titleAt / 0.75) * (folga / planeW)
  const titleXImg = flip ? planeX0 + planeW * (1 - along) : planeX0 + planeW * along
  const regFont = Math.max(6, bandH * ESCALA_PREFIXO[livery.regSize])
  const regY = bandBot - bandH * 0.12
  const regXImg = flip ? w * tx1 + w * 0.01 : w * tx0 - w * 0.01
  // Espelhar o grupo inverteria as letras; então cada texto é contra-espelhado
  // em torno da própria âncora, e a posição sai exata dos dois lados.
  const unflip = (x: number) => (flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined)

  return (
    <svg viewBox={view.join(' ')} className={className} role="img" aria-label={`${type.maker} ${type.name}`}>
      <defs>
        <mask id={`m-${uid}`} style={{ maskType: planeMask ? 'luminance' : 'alpha' }}>
          {/*
            A silhueta vira o recorte: tudo que for pintado fica dentro do avião.
            Quando existe o recorte conferido do sprite (public/sprites/planemasks/)
            é ele que manda — ver `planeMaskHref` em measure.ts para o porquê: a
            silhueta calculada aqui perdia 32% do avião, justamente a chapa clara,
            e era esse buraco que deixava o fundo da página aparecer no meio do
            motor. Sem o arquivo (a arte da Commons, por exemplo), cai na cópia
            com alfa sintético de measure.ts; sem medição ainda, cai no próprio
            arquivo como recorte provisório (mostra tudo, corrige no re-render).
          */}
          <image
            href={planeMask ?? (box?.maskHref || href)} x="0" y="0" width={w} height={h}
            crossOrigin="anonymous" onError={() => setFailed(true)}
          />
        </mask>
        {/*
          As máscaras de arquivo abaixo são `luminance`, não `alpha`, e isso não é
          detalhe: os PNG de public/sprites/*masks/ são cinza **opaco** — a forma
          está no brilho, não na transparência. Lidas como alfa, alfa ausente vale
          1 e a máscara deixa passar tudo, então o setor pintava a silhueta
          inteira em vez da peça. A máscara `m-` continua `alpha` porque a dela é
          montada num canvas por measure.ts, essa sim com alfa de verdade.
        */}
        {preciseTail && (
          <mask id={`ft-${uid}`} style={{ maskType: 'luminance' }}>
            {/*
              Contorno de verdade da deriva (public/sprites/tailmasks/), não a
              caixa aproximada de measure.ts — recorta a pintura pelo polígono
              real quando o modelo tem essa máscara conferida à mão.
            */}
            <image href={preciseTail} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        {tyreMask && (
          <mask id={`pm-${uid}`} style={{ maskType: 'luminance' }}>
            {/* O pneu (public/sprites/tyremasks/), que não é setor de livery. */}
            <image href={tyreMask} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        {bodyMask && (
          <mask id={`fm-${uid}`} style={{ maskType: 'luminance' }}>
            {/* O tubo da fuselagem (public/sprites/fuselagemasks/), que recorta
                a faixa para ela não respingar no intradorso da asa. */}
            <image href={bodyMask} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        {propMask && (
          <mask id={`hm-${uid}`} style={{ maskType: 'luminance' }}>
            {/* Pá e cone da hélice (public/sprites/propmasks/), idem. */}
            <image href={propMask} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        {wingletMask && (
          <mask id={`wgm-${uid}`} style={{ maskType: 'luminance' }}>
            {/* Dispositivo de ponta de asa (public/sprites/wingletmasks/). */}
            <image href={wingletMask} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        {windowMask && (
          <mask id={`jm-${uid}`} style={{ maskType: 'luminance' }}>
            {/* Fileira de janela de passageiro (public/sprites/windowmasks/). */}
            <image href={windowMask} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        {cockpitMask && livery.cockpit && (
          <mask id={`cpm-${uid}`} style={{ maskType: 'luminance' }}>
            <image href={cockpitMask} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        {leMask && livery.leadingEdge && (
          <mask id={`lem-${uid}`} style={{ maskType: 'luminance' }}>
            <image href={leMask} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        {topMask && livery.wingTop && (
          <mask id={`wtm-${uid}`} style={{ maskType: 'luminance' }}>
            <image href={topMask} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        {teMask && livery.trailingEdge && (
          <mask id={`tem-${uid}`} style={{ maskType: 'luminance' }}>
            <image href={teMask} x="0" y="0" width={w} height={h} crossOrigin="anonymous" />
          </mask>
        )}
        <linearGradient id={`tg-${uid}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={livery.tail} />
          <stop offset="100%" stopColor={livery.tailAccent} />
        </linearGradient>
        <linearGradient id={`cg-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={livery.cheat} />
          <stop offset="100%" stopColor={livery.cheat2} />
        </linearGradient>
      </defs>

      <g transform={flip ? flipTransform : undefined}>
        <g mask={`url(#m-${uid})`}>
          {/* fuselagem inteira */}
          <rect x="0" y="0" width={w} height={h} fill={livery.fuselage} />

          {/* As três faixas horizontais da fuselagem: dorso acima da fileira
              de janela, cabine no meio, ventre abaixo da linha do motor. As
              duas divisas vêm medidas por aeronave (fusebands.json). São
              retângulos sobre a silhueta inteira, não máscaras recortadas —
              recortar por fuselagemasks abriria anel de foto crua na divisa de
              cada peça. Sem cor escolhida não pintam nada e a fuselagem segue
              de uma cor só, como antes. */}
          {bands && livery.crown && (
            <rect x="0" y="0" width={w} height={h * bands.crown} fill={livery.crown} />
          )}
          {bands && livery.cabin && (
            <rect x="0" y={h * bands.crown} width={w} height={h * (bands.belly - bands.crown)} fill={livery.cabin} />
          )}
          {bands && livery.lowerBody && (
            <rect x="0" y={h * bands.belly} width={w} height={h} fill={livery.lowerBody} />
          )}

          {/* barriga, dentro da faixa da fuselagem */}
          <rect x="0" y={bellyY} width={w} height={bandBot - bellyY} fill={livery.belly} />

          {/* faixa, recortada pelo tubo quando ele existe: ver bodyMaskHref */}
          {livery.cheatStyle !== 'none' && (
            <g mask={bodyMask ? `url(#fm-${uid})` : undefined}>
              <Cheat
                livery={livery} w={w} x0={planeX0} planeW={planeW}
                bandTop={bandTop} bandBot={bandBot} mid={cheatMid} height={cheatH} gradId={`cg-${uid}`}
              />
            </g>
          )}

          {/* radome */}
          {noseColor && <rect x={planeX0 - 2} y={bandTop - 2} width={planeW * 0.06} height={bandH + 4} fill={noseColor} />}

          {/* A fileira de janela, depois da faixa: numa livery de verdade a
              faixa passa atrás da janela, nunca por cima dela.

              O interruptor "Janelas" ganha sentido aqui: desligado, a fileira é
              pintada com a cor da fuselagem, que é literalmente como se apaga
              uma fileira de janela — é o que se vê num cargueiro convertido. */}
          {windowMask && (
            <g mask={`url(#jm-${uid})`}>
              <rect x="0" y="0" width={w} height={h} fill={livery.windows ? livery.windowColor : livery.fuselage} />
            </g>
          )}

          {/* Vidraça da cabine, depois da faixa para o listrado não cobri-la.
              Sem cor escolhida não pinta nada e a foto aparece, como antes. */}
          {cockpitMask && livery.cockpit && (
            <g mask={`url(#cpm-${uid})`}>
              <rect x="0" y="0" width={w} height={h} fill={livery.cockpit} />
            </g>
          )}

          {/*
            Asa, motor e trem vêm DEPOIS da barriga e da faixa: na foto essas
            peças estão na frente da fuselagem, então pintura de fuselagem não
            pode passar por cima delas. Pintadas antes, a barriga cobria a asa
            inteira no c919, e175, sj100, arj21 e b753, e cortava metade da do
            a320.

            A **chapa** da asa não é mais pintada: fica com a cor da foto, que é
            o que se vê num pátio de verdade. O que a companhia pinta na asa são
            os bordos, e é isso que vem abaixo — cada faixa só quando tem cor
            escolhida.
          */}
          {leMask && livery.leadingEdge && (
            <g mask={`url(#lem-${uid})`}>
              <rect x="0" y="0" width={w} height={h} fill={livery.leadingEdge} />
            </g>
          )}
          {topMask && livery.wingTop && (
            <g mask={`url(#wtm-${uid})`}>
              <rect x="0" y="0" width={w} height={h} fill={livery.wingTop} />
            </g>
          )}
          {teMask && livery.trailingEdge && (
            <g mask={`url(#tem-${uid})`}>
              <rect x="0" y="0" width={w} height={h} fill={livery.trailingEdge} />
            </g>
          )}

          {/* Winglet logo depois da asa: a máscara da asa termina na quebra, e o
              dispositivo continua dali para cima. Sem isso o seletor de cor do
              winglet não fazia nada na arte de foto — só no desenho vetorial. */}
          {wingletMask && (
            <g mask={`url(#wgm-${uid})`}>
              <rect x="0" y="0" width={w} height={h} fill={livery.winglet} />
            </g>
          )}
          {/* Nacela e perna do trem **não** são pintadas: ficam com a cor de
              origem da foto. A tinta chapada na nacela matava o torneado da
              peça e o trem colorido deixava o avião com cara de brinquedo.

              O pneu, por outro lado, precisa de tinta própria: a foto é de um
              avião branco de fábrica e entra por multiply a 30%, então sem
              pintar a roda saía cinza. */}
          {tyreMask && (
            <g mask={`url(#pm-${uid})`}>
              <rect x="0" y="0" width={w} height={h} fill={BORRACHA} />
            </g>
          )}
          {/* A hélice, pela mesma razão do pneu, e depois da asa e do motor:
              na foto ela passa na frente dos dois. */}
          {propMask && (
            <g mask={`url(#hm-${uid})`}>
              <rect x="0" y="0" width={w} height={h} fill={HELICE} />
            </g>
          )}

          {/* deriva — com máscara precisa por cima da caixa, quando existe */}
          <g mask={preciseTail ? `url(#ft-${uid})` : undefined}>
            <rect
              x={w * tx0} y={h * ty0} width={tailW} height={h * (ty1 - ty0)}
              fill={livery.tailStyle === 'gradient' ? `url(#tg-${uid})` : livery.tail}
            />
            {livery.tailStyle === 'stripes' &&
              [0, 1, 2].map((i) => (
                <rect
                  key={i} x={w * tx0 + tailW * (0.18 + i * 0.24)} y={h * ty0}
                  width={tailW * 0.12} height={h * (ty1 - ty0)} fill={livery.tailAccent}
                />
              ))}
            {livery.tailStyle === 'split' && (
              <path
                d={
                  `M ${w * tx0} ${h * ty0 + (h * (ty1 - ty0)) * 0.55} L ${w * tx1} ${h * ty0 + (h * (ty1 - ty0)) * 0.28} ` +
                  `L ${w * tx1} ${h * ty1} L ${w * tx0} ${h * ty1} Z`
                }
                fill={livery.tailAccent}
              />
            )}
            {livery.tailStyle === 'swoosh' && (
              <path
                d={
                  `M ${w * tx0} ${h * ty1} ` +
                  `C ${w * tx0 + tailW * 0.5} ${h * ty0 + (h * (ty1 - ty0)) * 0.7}, ` +
                  `${w * tx0 + tailW * 0.66} ${h * ty0 + (h * (ty1 - ty0)) * 0.25}, ` +
                  `${w * tx0 + tailW * 0.7} ${h * ty0} L ${w * tx1} ${h * ty0} ` +
                  `C ${w * tx0 + tailW * 0.95} ${h * ty0 + (h * (ty1 - ty0)) * 0.55}, ` +
                  `${w * tx0 + tailW * 0.7} ${h * ty0 + (h * (ty1 - ty0)) * 0.9}, ` +
                  `${w * tx0 + tailW * 0.5} ${h * ty1} Z`
                }
                fill={livery.tailAccent}
              />
            )}
            {livery.tailStyle === 'chevron' && (
              <path
                d={
                  `M ${w * tx0 + tailW * 0.1} ${h * ty1} L ${w * tx0 + tailW * 0.54} ${h * ty0} ` +
                  `L ${w * tx0 + tailW * 0.8} ${h * ty0} L ${w * tx0 + tailW * 0.4} ${h * ty1} Z`
                }
                fill={livery.tailAccent}
              />
            )}
          </g>

          {livery.emblem !== 'none' && (
            <Emblem livery={livery} region={emblemZone} w={w} h={h} />
          )}
        </g>

        {/* o desenho original por cima devolve painéis, portas e sombreado */}
        <image
          href={href} x="0" y="0" width={w} height={h} crossOrigin="anonymous"
          style={{ mixBlendMode: 'multiply' }} opacity="0.3"
        />
      </g>

      <g transform={flip ? flipTransform : undefined}>
        {titles && (
          <g transform={unflip(titleXImg)}>
            <text
              x={titleXImg} y={titleY} fill={livery.titles}
              fontFamily={FONT_STACK[livery.titleFont]} fontSize={titleSize}
              fontWeight={livery.titleFont === 'wide' ? 900 : 700}
              letterSpacing={livery.titleFont === 'wide' ? '0.04em' : '0'}
              dominantBaseline="middle"
            >
              {titles}
            </text>
          </g>
        )}
        {livery.showReg && registration && (
          <g transform={unflip(regXImg)}>
            <text
              x={regXImg} y={regY} fill={livery.regColor}
              fontFamily={FONT_STACK.mono} fontSize={regFont} textAnchor="end"
            >
              {registration}
            </text>
          </g>
        )}
        {/* A bandeira do país da primeira matrícula, à frente do prefixo. Fica
            fora do grupo espelhado pelo mesmo motivo dos textos: espelhada, a
            bandeira sai invertida, e bandeira invertida é outra bandeira. */}
        {livery.flag && flagCC && (
          <g transform={unflip(regXImg)}>
            <Bandeira
              cc={flagCC}
              x={regXImg - (registration && livery.showReg ? regFont * 0.62 * (registration.length + 1) : 0) - regFont * 1.9}
              y={regY - regFont * 0.78}
              h={regFont * 0.95}
            />
          </g>
        )}
      </g>
    </svg>
  )
}

/**
 * Desenha o emblema centrado na caixa segura medida em `measure.ts` (ou o
 * padrão de `DEFAULT_REGIONS`) — a silhueta é um PNG fixo da Meshy, então o
 * tamanho vem do lado menor da caixa (nunca estica) e a cor é aplicada por
 * máscara de alfa, com um crachá de fundo em `emblemAccent` atrás pra dar o
 * segundo tom sem depender do desenho ter duas camadas.
 */
function Emblem({
  livery, region, w, h,
}: {
  livery: Livery
  region: { cx: number; cy: number; maxW: number; maxH: number }
  w: number
  h: number
}) {
  const uid = useId().replace(/:/g, '')
  const href = emblemHref(livery.emblem)
  if (!href) return null
  // Três degraus dentro da caixa segura da deriva: "grande" é o que a peça
  // comporta, e não um tamanho maior que ela.
  const size = Math.min(region.maxW * w, region.maxH * h) * ESCALA_EMBLEMA[livery.emblemSize]
  const cx = region.cx * w
  const cy = region.cy * h
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={size * 0.62} fill={livery.emblemAccent} />
      <mask id={`em-${uid}`} style={{ maskType: 'alpha' }}>
        <image href={href} x={-size / 2} y={-size / 2} width={size} height={size} crossOrigin="anonymous" />
      </mask>
      <rect x={-size / 2} y={-size / 2} width={size} height={size} fill={livery.emblemColor} mask={`url(#em-${uid})`} />
    </g>
  )
}

function Cheat({
  livery, w, x0, planeW, bandTop, bandBot, mid, height, gradId,
}: {
  livery: Livery
  w: number
  x0: number
  planeW: number
  bandTop: number
  bandBot: number
  mid: number
  height: number
  gradId: string
}) {
  const fill = livery.cheatStyle === 'fade' ? `url(#${gradId})` : livery.cheat
  switch (livery.cheatStyle) {
    case 'straight':
    case 'fade':
      return <rect x="0" y={mid - height / 2} width={w} height={height} fill={fill} />
    case 'wide':
      return <rect x="0" y={mid - height / 2} width={w} height={bandBot - (mid - height / 2)} fill={fill} />
    case 'double':
      return (
        <>
          <rect x="0" y={mid - height} width={w} height={height * 0.62} fill={livery.cheat} />
          <rect x="0" y={mid + height * 0.25} width={w} height={height * 0.44} fill={livery.cheat2} />
        </>
      )
    case 'wave':
      return (
        <path
          d={
            `M ${x0 - planeW * 0.1} ${mid + height * 1.4} ` +
            `C ${x0 + planeW * 0.35} ${mid + height * 1.5}, ${x0 + planeW * 0.6} ${mid - height * 1.6}, ${x0 + planeW * 1.1} ${mid - height * 2.1} ` +
            `L ${x0 + planeW * 1.1} ${mid - height * 0.9} ` +
            `C ${x0 + planeW * 0.6} ${mid - height * 0.4}, ${x0 + planeW * 0.35} ${mid + height * 2.6}, ${x0 - planeW * 0.1} ${mid + height * 2.5} Z`
          }
          fill={fill}
        />
      )
    case 'split':
      return (
        <path
          d={
            `M 0 ${bandBot} L ${w} ${bandBot} L ${w} ${mid - height} ` +
            `L ${x0 + planeW * 0.22} ${mid + height * 1.6} L 0 ${bandTop + (bandBot - bandTop) * 0.95} Z`
          }
          fill={fill}
        />
      )
    case 'chevron': {
      // galões apontando para o nariz, repetidos ao longo da fuselagem
      const n = 5
      const passo = planeW / n
      const alt = height * 1.5
      return (
        <>
          {Array.from({ length: n }, (_, i) => {
            const bx = x0 + passo * i
            return (
              <path
                key={i}
                d={`M ${bx} ${mid - alt} L ${bx + passo * 0.55} ${mid} L ${bx} ${mid + alt} ` +
                   `L ${bx + passo * 0.28} ${mid + alt} L ${bx + passo * 0.83} ${mid} ` +
                   `L ${bx + passo * 0.28} ${mid - alt} Z`}
                fill={i % 2 ? livery.cheat2 : livery.cheat}
              />
            )
          })}
        </>
      )
    }
    case 'delta':
      // cunha que sobe da barriga no nariz até o topo na cauda
      return (
        <path
          d={`M ${x0 - planeW * 0.05} ${bandBot} L ${x0 + planeW * 1.05} ${bandTop} ` +
             `L ${x0 + planeW * 1.05} ${bandBot} Z`}
          fill={fill}
        />
      )
    case 'diagonal':
      // faixa única inclinada, subindo para a cauda
      return (
        <path
          d={`M ${x0 - planeW * 0.05} ${mid + height * 1.8} L ${x0 + planeW * 1.05} ${mid - height * 1.8} ` +
             `L ${x0 + planeW * 1.05} ${mid - height * 0.4} L ${x0 - planeW * 0.05} ${mid + height * 3.2} Z`}
          fill={fill}
        />
      )
    case 'ribbon':
      // duas diagonais que se cruzam no meio da fuselagem
      return (
        <>
          <path
            d={`M ${x0 - planeW * 0.05} ${mid + height * 1.6} L ${x0 + planeW * 1.05} ${mid - height * 1.6} ` +
               `L ${x0 + planeW * 1.05} ${mid - height * 0.5} L ${x0 - planeW * 0.05} ${mid + height * 2.7} Z`}
            fill={livery.cheat}
          />
          <path
            d={`M ${x0 - planeW * 0.05} ${mid - height * 1.6} L ${x0 + planeW * 1.05} ${mid + height * 1.6} ` +
               `L ${x0 + planeW * 1.05} ${mid + height * 2.7} L ${x0 - planeW * 0.05} ${mid - height * 0.5} Z`}
            fill={livery.cheat2}
          />
        </>
      )
    case 'triband': {
      // três filetes finos, o do meio na segunda cor
      const e = height * 0.3
      return (
        <>
          <rect x="0" y={mid - height} width={w} height={e} fill={livery.cheat} />
          <rect x="0" y={mid - e / 2} width={w} height={e} fill={livery.cheat2} />
          <rect x="0" y={mid + height - e} width={w} height={e} fill={livery.cheat} />
        </>
      )
    }
    case 'checker': {
      // fileira de losangos, alternando as duas cores
      const n = 9
      const passo = planeW / n
      const r = height * 0.9
      return (
        <>
          {Array.from({ length: n }, (_, i) => {
            const cx = x0 + passo * (i + 0.5)
            return (
              <path
                key={i}
                d={`M ${cx} ${mid - r} L ${cx + r} ${mid} L ${cx} ${mid + r} L ${cx - r} ${mid} Z`}
                fill={i % 2 ? livery.cheat2 : livery.cheat}
              />
            )
          })}
        </>
      )
    }
    case 'billboard':
      // bloco cheio na traseira, do topo à base da fuselagem
      return (
        <rect x={x0 + planeW * 0.55} y={bandTop} width={planeW * 0.55} height={bandBot - bandTop} fill={fill} />
      )
    case 'sunray': {
      // leque de raios saindo da cauda, abrindo para o nariz
      const n = 6
      const origem = { x: x0 + planeW * 1.02, y: mid }
      return (
        <>
          {Array.from({ length: n }, (_, i) => {
            const t = (i - (n - 1) / 2) / n
            const y1 = mid + t * height * 7
            const y2 = mid + t * height * 7 + height * 0.55
            return (
              <path
                key={i}
                d={`M ${origem.x} ${origem.y} L ${x0 - planeW * 0.05} ${y1} L ${x0 - planeW * 0.05} ${y2} Z`}
                fill={i % 2 ? livery.cheat2 : livery.cheat}
              />
            )
          })}
        </>
      )
    }
    default:
      return null
  }
}
