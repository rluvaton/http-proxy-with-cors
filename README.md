# HTTP proxy with cors

Proxy HTTP requests with cors enabled.

## Usage

```bash
npx proxy-http-with-cors <local-port-1> <upstream-1> ... <local-port-n> <upstream-n>
```

It will create a proxy server on each local port that will proxy all requests to the upstream server.


### Options

To disable logging, set the `LOG_DISABLED` environment variable to `false`.
