/** Comprimento físico da maior pista pavimentada, revisão de 02/10/2026.
 * A referência anterior continua exclusiva da simulação (permissões, demanda e obras).
 * Não confundir comprimento físico com LDA/TORA, que podem variar por cabeceira.
 * Fontes, divergências e critério: docs/pistas-auditadas.md.
 */
export const RUNWAY_CORRECTIONS: Record<string, { previousFeet: number; meters: number; source: string }> = {
  AUX: { previousFeet: 5919, meters: 1799, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SWGN&i=aerodromos' },
  CGH: { previousFeet: 6365, meters: 1883, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBSP&i=aerodromos' },
  CLV: { previousFeet: 6890, meters: 2110, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBCN&i=aerodromos' },
  JOI: { previousFeet: 5381, meters: 1540, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBJV&i=aerodromos' },
  KBP: { previousFeet: 10827, meters: 4000, source: 'https://ourairports.com/airports/UKBB/runways.html' },
  LAJ: { previousFeet: 5020, meters: 1532, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBLJ&i=aerodromos' },
  MGF: { previousFeet: 7783, meters: 2380, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBMG&i=aerodromos' },
  MII: { previousFeet: 4921, meters: 1700, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBML&i=aerodromos' },
  MVF: { previousFeet: 6562, meters: 1900, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBMS&i=aerodromos' },
  OPP: { previousFeet: 6102, meters: 1600, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SNSM&i=aerodromos' },
  OPS: { previousFeet: 5348, meters: 2000, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBSI&i=aerodromos' },
  PET: { previousFeet: 6496, meters: 1823, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBPK&i=aerodromos' },
  PHB: { previousFeet: 6890, meters: 2500, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBPB&i=aerodromos' },
  PLU: { previousFeet: 8333, meters: 2364, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBBH&i=aerodromos' },
  PMG: { previousFeet: 6562, meters: 1927, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBPP&i=aerodromos' },
  PNZ: { previousFeet: 9055, meters: 3250, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBPL&i=aerodromos' },
  PPB: { previousFeet: 6923, meters: 2100, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBDN&i=aerodromos' },
  PQC: { previousFeet: 9843, meters: 3300, source: 'https://caa.gov.vn/hoat-dong-nganh/chuyen-bay-hieu-chuan-dau-tien-tai-duong-cat-ha-canh-so-2-cang-hang-khong-quoc-te-phu-quoc-20260728091729379.htm' },
  REC: { previousFeet: 9865, meters: 2937, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBRF&i=aerodromos' },
  SJK: { previousFeet: 8780, meters: 2675, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBSJ&i=aerodromos' },
  SSA: { previousFeet: 9859, meters: 3003, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBSV&i=aerodromos' },
  TFF: { previousFeet: 7218, meters: 2000, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBTF&i=aerodromos' },
  THE: { previousFeet: 7218, meters: 2118, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBTE&i=aerodromos' },
  UDI: { previousFeet: 6398, meters: 2100, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBUL&i=aerodromos' },
  UNA: { previousFeet: 6234, meters: 2000, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBTC&i=aerodromos' },
  URG: { previousFeet: 4921, meters: 1304, source: 'https://aisweb.decea.mil.br/index.cfm?codigo=SBUG&i=aerodromos' },
}
