/**
 * Create an error with a message and a flag to show help.
 * @param {string} message
 * @param {boolean} showHelp
 * @return {Error}
 */
export function createError({ message, showHelp = false }) {
  const error = new Error(message);
  error.showHelp = showHelp;
  return error;
}

export class CLIError extends Error {
  /**
   * @param {string} message
   * @param {boolean=false} showHelp
   */
  constructor({ message, showHelp = false }) {
    super(message);
    this.showHelp = showHelp;
  }
}
