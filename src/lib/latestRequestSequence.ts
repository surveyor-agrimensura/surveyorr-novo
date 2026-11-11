/** Identifica a resposta mais recente de uma operação assíncrona substituível. */
export class LatestRequestSequence {
  private sequence = 0;

  begin(): number {
    return ++this.sequence;
  }

  isCurrent(request: number): boolean {
    return request === this.sequence;
  }
}
