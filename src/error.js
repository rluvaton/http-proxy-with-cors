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
