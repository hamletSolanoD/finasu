import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { categorizeTicket } from '../modelRouter/index.js'

interface RequestBody {
  ocrText: string
  imageBase64?: string
  categories: string[]
}

function parseBody(event: APIGatewayProxyEventV2): RequestBody {
  if (!event.body) throw new Error('Cuerpo de la petición vacío')
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body
  const body = JSON.parse(raw)
  if (typeof body.ocrText !== 'string' || !Array.isArray(body.categories)) {
    throw new Error('ocrText (string) y categories (string[]) son requeridos')
  }
  return body
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const body = parseBody(event)
    const result = await categorizeTicket(body)
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
    }
  }
}
