# Zoom e alinhamento visual

O gesto e os botões atualizam imediatamente a transformação do mapa, entre 0,75× e 1152×. Não existe mais debounce para escolher as imagens do novo nível. O próximo nível central é antecipado; até 128 blocos permanecem montados e as imagens mais detalhadas ficam por cima das anteriores. Voltar a uma região ainda no cache não apaga os detalhes já carregados. Não há animação de opacidade ou filtro de desfoque.

Uma região inédita ainda depende da rede e da disponibilidade da fonte. Enquanto carrega, o melhor bloco disponível permanece visível. O fundo local também permite usar os controles sem internet. O cache é limitado para não manter o planeta inteiro decodificado no celular.

A fila permite seis downloads simultâneos, prioriza os blocos da tela e cancela pedidos intermediários que perderam relevância. A antecipação só ocupa os lugares restantes da fila. Um pedido sem resposta por 15 segundos falha sem prender os demais.

Os blocos são desenhados na extensão geográfica exata, sem esticar a imagem em um pixel para esconder juntas. NASA GIBS Blue Marble fornece os níveis gerais; os níveis próximos usam Esri World Imagery exportado em EPSG:4326. As coordenadas, imagens e trajetórias usam a mesma projeção equiretangular. Referências: [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) e [Esri Export Map](https://developers.arcgis.com/rest/services-reference/enterprise/export-map/).

## Posições e cabeceiras

`airportCoordinates.json` contém 3.087 posições de aeródromos, obtidas no [OurAirports](https://ourairports.com/data/) em 03/10/2026, para substituir coordenadas arredondadas quando não existe pista no catálogo visual. Os dados são abertos; não foram todos conferidos individualmente contra levantamento oficial.

`verifiedRunways.json` usa as coordenadas THR publicadas pelo DECEA, AD 2.12, para SDU/SBRJ, GIG/SBGL, CGH/SBSP, GRU/SBGR, BSB/SBBR, PVH/SBPV e MAO/SBEG. Exemplo de [carta de referência SDU](https://aisweb.decea.mil.br/eaip/20-2026_2026_10_01/eAIP/AD%202%20SBRJ-pt-BR.html). A mesma edição foi consultada para os outros seis códigos ICAO. As cabeceiras deslocadas podem tornar a distância entre THRs menor que o comprimento físico total.

As correções oficiais prevalecem desde o primeiro quadro e também depois do carregamento dos procedimentos. A saída prolonga o eixo por 1,5 km; a final de pouso entra alinhada ao eixo a 3 km da cabeceira. Os procedimentos intermediários continuam vindos dos arquivos já existentes. O marcador fica no meio da pista principal e diminui no zoom próximo para não encobri-la. Onde não há geometria de pista, o trajeto usa a posição precisa do aeródromo, sem inventar uma cabeceira.

Estas alterações são visuais: não mudam alcance, restrições de aeronaves, distâncias econômicas, comprimentos operacionais ou slots.

Importador: `npx tsx scripts/import-map-coordinates.ts airports.csv official-runways.json`. O segundo arquivo mapeia IATA para registros `{id,lat,lon,length}`, com coordenadas compactas DMS e comprimento em metros, transcritos de AD 2.12. Os resultados são versionados; o jogo não consulta as fontes cadastrais durante a execução.

## Verificação

- `map:tiles`: cobertura e alinhamento da grade, polos, linha de data e tela vertical.
- `map:tiles:ui`: controles, cache montado, retorno ao mesmo zoom, falha de rede e limite de nós em 360/1365 px.
- `LIVE_MAP=1 npm run map:tiles:ui`: inspeção com imagens reais em vez das respostas locais do CI.
- `airport-paths-check.ts`: coordenadas oficiais, cabeceiras, prolongamento dos eixos e inversões visuais.
- `map:geometry`: posição e orientação das aeronaves sobre a mesma curva desenhada.
