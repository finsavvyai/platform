import * as vscode from "vscode";

export abstract class Disposable implements vscode.Disposable {
  private _isDisposed = false;
  private readonly disposables: vscode.Disposable[] = [];

  protected addDisposable<T extends vscode.Disposable>(disposable: T): T {
    if (this._isDisposed) {
      disposable.dispose();
      throw new Error("Cannot add disposable to already disposed object");
    }
    this.disposables.push(disposable);
    return disposable;
  }

  protected removeDisposable(disposable: vscode.Disposable): void {
    const index = this.disposables.indexOf(disposable);
    if (index >= 0) {
      this.disposables.splice(index, 1);
    }
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;

    // Dispose all registered disposables in reverse order
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop()!;
      try {
        disposable.dispose();
      } catch (error) {
        console.error("Error disposing resource:", error);
      }
    }
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  protected throwIfDisposed(): void {
    if (this._isDisposed) {
      throw new Error("Object has been disposed");
    }
  }
}

export class CompositeDisposable extends Disposable {
  constructor(...disposables: vscode.Disposable[]) {
    super();
    disposables.forEach((d) => this.addDisposable(d));
  }

  public add<T extends vscode.Disposable>(disposable: T): T {
    return this.addDisposable(disposable);
  }

  public remove(disposable: vscode.Disposable): void {
    this.removeDisposable(disposable);
  }

  public clear(): void {
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop()!;
      this.removeDisposable(disposable);
      disposable.dispose();
    }
  }

  public get count(): number {
    return this.disposables.length;
  }
}

export function disposeAll(disposables: Iterable<vscode.Disposable>): void {
  for (const disposable of disposables) {
    try {
      disposable.dispose();
    } catch (error) {
      console.error("Error disposing resource:", error);
    }
  }
}

export function toDisposable(fn: () => void): vscode.Disposable {
  return {
    dispose: fn,
  };
}
