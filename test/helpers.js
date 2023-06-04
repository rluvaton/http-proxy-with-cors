import net from 'node:net';
import inspector from 'node:inspector';

export function isDebug() {
  return inspector.url() !== undefined;
}

/**
 * @return {Promise<number>}
 */
async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

/**
 * @param {number} numberOfAvailablePortsToSearch
 * @return {Promise<number[]>}
 */
export function getAvailablePorts(numberOfAvailablePortsToSearch) {
  return Promise.all(Array.from({ length: numberOfAvailablePortsToSearch }, findAvailablePort));
}
