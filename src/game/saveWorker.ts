import LZString from 'lz-string'
self.onmessage=({data})=>{
  const json=JSON.stringify(data.state)
  self.postMessage({slot:data.slot,version:data.version,encoded:json.length>1_000_000?'LZ1:'+LZString.compressToUTF16(json):json})
}
