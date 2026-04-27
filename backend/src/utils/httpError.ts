export class HttpError extends Error {
  status: number;
  expose: boolean;

  constructor(status: number, message: string, expose = true) {
    super(message);
    this.status = status;
    this.expose = expose;
  }
}

