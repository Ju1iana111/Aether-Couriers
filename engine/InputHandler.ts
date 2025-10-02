export class InputHandler {
  private keys: Set<string> = new Set();
  private mousePressed: boolean = false;

  public init(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.keys.clear();
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key.toLowerCase());
  }

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  }

  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) { // Left mouse button
        this.mousePressed = true;
    }
  }

  private handleMouseUp = (e: MouseEvent): void => {
      if (e.button === 0) { // Left mouse button
          this.mousePressed = false;
      }
  }

  public isPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  public isMousePressed(): boolean {
    return this.mousePressed;
  }
}