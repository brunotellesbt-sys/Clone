import {advanceDay} from './engine'
import type {GameState} from './types'

self.onmessage=({data}:{data:{state:GameState}})=>{
  try {self.postMessage({state:advanceDay(data.state)})}
  catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)})}
}
