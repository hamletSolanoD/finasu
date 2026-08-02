import { categorizeTicket } from '../modelRouter/index.js'

const SAMPLE_OCR = `
OXXO TIENDA #4821
AV. INSURGENTES SUR 1234
FECHA: 12/03/2026  10:47
--------------------------
COCA COLA 600ML         18.00
SABRITAS ORIGINAL 45G   17.50
AGUA CIEL 1L            15.00
--------------------------
TOTAL                   50.50
EFECTIVO                60.00
CAMBIO                   9.50
GRACIAS POR SU COMPRA
`.trim()

const CATEGORIES = ['Comida', 'Transporte', 'Hogar', 'Salud', 'Entretenimiento', 'Otros']

async function main() {
  const result = await categorizeTicket({
    ocrText: SAMPLE_OCR,
    categories: CATEGORIES,
  })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
