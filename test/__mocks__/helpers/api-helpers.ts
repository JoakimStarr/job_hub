import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { apiResolver } from 'next/dist/server/api-utils/node'
import type { NextApiHandler } from 'next'

export interface TestRequest {
  method: string
  body?: any
  headers?: Record<string, string>
  query?: Record<string, string>
  cookies?: Record<string, string>
}

export interface TestResponse {
  status: number
  body: any
  headers: Record<string, string>
}

export async function testApiEndpoint(
  handler: NextApiHandler,
  request: TestRequest
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        await apiResolver(
          req,
          res,
          undefined,
          handler,
          {} as any,
          false
        )
      } catch (error) {
        reject(error)
      }
    })

    const options = {
      method: request.method,
      path: `/api/test`,
      headers: {
        'Content-Type': 'application/json',
        ...request.headers,
      },
    }

    const req = new Request(`http://localhost${options.path}`, options)
    if (request.body) {
      // Note: In real implementation, you'd need to handle body serialization
    }

    // Simulate the request
    const mockReq = {
      method: request.method,
      headers: options.headers,
      url: options.path + (request.query ? '?' + new URLSearchParams(request.query).toString() : ''),
    } as any

    if (request.body) {
      mockReq.body = JSON.stringify(request.body)
    }

    let responseData = ''
    let responseStatus = 200
    const responseHeaders: Record<string, string> = {}

    const mockRes = {
      statusCode: 200,
      setHeader(key: string, value: string) {
        responseHeaders[key] = value
        return this
      },
      end(data: any) {
        responseData = data || ''
        responseStatus = this.statusCode
        resolve({
          status: responseStatus,
          body: responseData ? JSON.parse(responseData) : null,
          headers: responseHeaders,
        })
        server.close()
      },
      json(data: any) {
        this.setHeader('Content-Type', 'application/json')
        this.end(JSON.stringify(data))
      },
      status(code: number) {
        this.statusCode = code
        return this
      }
    } as any

    try {
      handler(mockReq as any, mockRes as any)
    } catch (error) {
      reject(error)
    }
  })
}

export function expectSuccess(response: TestResponse): void {
  expect(response.status).toBeGreaterThanOrEqual(200)
  expect(response.status).toBeLessThan(300)
}

export function expectError(
  response: TestResponse,
  expectedStatus?: number
): void {
  if (expectedStatus) {
    expect(response.status).toBe(expectedStatus)
  }
  expect(response.status).toBeGreaterThanOrEqual(400)
}
