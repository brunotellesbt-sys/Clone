import type {GameState} from './types'

/** Um dia por vez; a cópia calculada nunca modifica o estado que recebe cliques. */
export class DaySimulation {
  private worker:Worker
  private pending?:{resolve:(s:GameState)=>void;reject:(e:Error)=>void}
  constructor(){
    this.worker=new Worker(new URL('./dayWorker.ts',import.meta.url),{type:'module'})
    this.worker.onmessage=({data}:{data:{state?:GameState;error?:string}})=>{
      const job=this.pending;this.pending=undefined
      if(data.error||!data.state)job?.reject(new Error(data.error??'Resultado de simulação inválido'))
      else job?.resolve(data.state)
    }
    this.worker.onerror=event=>{const job=this.pending;this.pending=undefined;job?.reject(new Error(event.message||'Falha na simulação'))}
  }
  advance(state:GameState){
    if(this.pending)return Promise.reject(new Error('Já existe um dia em cálculo'))
    return new Promise<GameState>((resolve,reject)=>{
      this.pending={resolve,reject}
      try{this.worker.postMessage({state})}
      catch(error){this.pending=undefined;reject(error)}
    })
  }
  dispose(){
    this.worker.terminate();this.pending?.reject(new Error('Simulação interrompida'));this.pending=undefined
  }
}
