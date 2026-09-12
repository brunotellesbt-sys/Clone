import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearSave, exportSave, loadGame } from '../../game/save'

interface Props {
  children: ReactNode
}

interface State {
  erro: Error | null
  pilha: string
}

/**
 * Barreira de erro: quando alguma tela quebra, mostra o que quebrou.
 *
 * Sem ela um erro de render em React desmonta a árvore inteira e o jogador fica
 * com a **tela preta** — foi assim que o relato chegou, num vídeo de celular:
 * clicou em "Decolar" e a página apagou. Tela preta não diz nada a quem joga
 * nem a quem conserta; o jogo não tem servidor nem telemetria, então a mensagem
 * de erro só existe se estiver na tela.
 *
 * Oferece as duas saídas que fazem sentido aqui: recarregar (erro de uma vez
 * só) e apagar o save (save antigo que o formato novo não digere — a causa mais
 * provável de quebrar sempre no mesmo ponto). Antes de apagar, dá para copiar o
 * save, porque jogar fora a companhia do jogador sem cópia é pior que o erro.
 */
export class Boundary extends Component<Props, State> {
  state: State = { erro: null, pilha: '' }

  static getDerivedStateFromError(erro: Error): Partial<State> {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    this.setState({ pilha: info.componentStack ?? '' })
    console.error('quebrou:', erro, info.componentStack)
  }

  copiarSave = () => {
    const s = loadGame()
    if (!s) return
    navigator.clipboard?.writeText(exportSave(s)).catch(() => {})
  }

  render() {
    const { erro, pilha } = this.state
    if (!erro) return this.props.children
    return (
      <div className="card" style={{ margin: 16, maxWidth: 720 }}>
        <h2 style={{ marginTop: 0 }}>O jogo travou aqui</h2>
        <p>
          Isto é um defeito, não uma escolha. A mensagem abaixo diz onde foi — vale copiar antes de
          recarregar.
        </p>
        <pre
          style={{
            whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5, padding: 12,
            background: 'rgba(0,0,0,.35)', borderRadius: 8, maxHeight: 260, overflow: 'auto',
          }}
        >
          {erro.message}
          {pilha ? `\n${pilha.split('\n').slice(0, 8).join('\n')}` : ''}
        </pre>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => location.reload()}>Recarregar</button>
          <button onClick={this.copiarSave}>Copiar o save</button>
          <button
            onClick={() => {
              clearSave()
              location.reload()
            }}
          >
            Apagar o save e começar de novo
          </button>
        </div>
      </div>
    )
  }
}
