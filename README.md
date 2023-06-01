# HTTP proxy with cors

Proxy HTTP requests with cors enabled.

## Usage
It will create a proxy server on each local port that will proxy all requests to the upstream server.

### CLI arguments
```bash
npx proxy-http-with-cors <local-port-1> <upstream-1> ... <local-port-n> <upstream-n>
```

### From file
```bash
npx proxy-http-with-cors --file <path-to-json-file>
```

Example config file:
```json
[
  {
    "port": 3000,
    "upstream": "https://us1.api.server.com"
  },
  {
    "port": 3001,
    "upstream": "https://us2.api.server.com"
  }
]
```

### Options

#### Config
you can pass the server from a config file using (`-f` or `--file`) or pass them as `port` and `upstream` arguments.

#### Logging
To disable logging, set the `LOG_DISABLED` environment variable to `false`.


