// What the stand-ins of the script suites share (`tests/sonar-stub.ts`,
// `tests/github-stub.ts`): the reply shape, the statuses, the outage a
// scenario scripts before it answers, and the server itself. Each
// stand-in is a process of its own because the suites run the script
// under test synchronously, and a server inside the test process could
// not answer while that call blocks.
import { type IncomingMessage, createServer } from 'node:http'

export type Reply = readonly [status: number, body: unknown]

export const HTTP = {
  badRequest: 400,
  forbidden: 403,
  notFound: 404,
  ok: 200,
  unauthorized: 401,
  unavailable: 503,
}

export interface Outage {
  // The status the outage answers with, 503 unless the scenario says.
  readonly failureStatus?: number
  // Fires once per stub lifetime: the stand-in counts the outage down
  // and never re-arms it, so a scenario with an outage serves one run.
  readonly failuresFirst?: number
}

// The outage of each scenario, counted down across the requests the
// stand-in receives: the failures first, then nothing.
export const createOutage = (): ((
  key: string,
  outage: Outage,
) => number | undefined) => {
  const failuresLeft = new Map<string, number>()
  return (key, { failureStatus, failuresFirst }) => {
    const left = failuresLeft.get(key) ?? failuresFirst ?? 0
    failuresLeft.set(key, Math.max(left - 1, 0))
    return left > 0 ? (failureStatus ?? HTTP.unavailable) : undefined
  }
}

// Prints the port it listens on, then serves until it is killed or its
// stdin closes: the stand-in exits with the test process even when
// `afterAll` never runs (a crashed or signalled worker), since the OS
// closes its end of stdin as it dies. The stream is resumed for that
// alone: a paused one never reports its end.
export const serve = (answer: (request: IncomingMessage) => Reply): void => {
  const server = createServer((request, response) => {
    const [status, body] = answer(request)
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  })
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    const port =
      typeof address === 'object' && address !== null ? address.port : 0
    process.stdout.write(`PORT=${String(port)}\n`)
  })
  process.stdin.on('end', () => {
    server.close()
  })
  process.stdin.resume()
}
