interface StackNode<T> {
  readonly value: T;
  readonly below: StackNode<T> | null;
}

// Persistent linked stack: push/pop return new stacks that share their tail
export class Stack<T = string> {
  private keyCache: string | null = null;

  private constructor(
    private readonly top: StackNode<T> | null,
    readonly size: number,
  ) {}

  static empty<T = string>(): Stack<T> {
    return new Stack<T>(null, 0);
  }

  static of<T = string>(items: Iterable<T>): Stack<T> {
    return [...items].reverse().reduce((stack, item) => stack.push(item), Stack.empty<T>());
  }

  push(value: T): Stack<T> {
    return new Stack({ value, below: this.top }, this.size + 1);
  }

  pushAll(values: Iterable<T>): Stack<T> {
    return [...values].reverse().reduce<Stack<T>>((stack, v) => stack.push(v), this);
  }

  pop(): [T, Stack<T>] {
    if (!this.top) throw new RangeError("pop from empty stack");
    return [this.top.value, new Stack(this.top.below, this.size - 1)];
  }

  peek(): T | undefined {
    return this.top?.value;
  }

  isEmpty(): boolean {
    return this.top === null;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let node = this.top; node; node = node.below) yield node.value;
  }

  snapshot(): T[] {
    return [...this];
  }

  key(): string {
    this.keyCache ??= this.snapshot().join("\u0001");
    return this.keyCache;
  }
}

// FIFO queue on a growable ring buffer: O(1) enqueue and dequeue
export class Queue<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(initial: Iterable<T> = [], capacity = 16) {
    this.buffer = new Array(capacity);
    for (const item of initial) this.enqueue(item);
  }

  get size(): number {
    return this.count;
  }

  enqueue(item: T): void {
    if (this.count === this.buffer.length) this.grow();
    this.buffer[(this.head + this.count) % this.buffer.length] = item;
    this.count += 1;
  }

  dequeue(): T | undefined {
    if (this.count === 0) return undefined;
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.buffer.length;
    this.count -= 1;
    return item;
  }

  private grow(): void {
    const next = new Array<T | undefined>(this.buffer.length * 2);
    for (let i = 0; i < this.count; i++) next[i] = this.buffer[(this.head + i) % this.buffer.length];
    this.buffer = next;
    this.head = 0;
  }
}

// Sparse two-way infinite tape: only non-blank cells are stored
export class Tape {
  private readonly cells = new Map<number, string>();

  constructor(
    readonly blank: string,
    content = "",
  ) {
    [...content].forEach((symbol, i) => this.write(i, symbol));
  }

  read(position: number): string {
    return this.cells.get(position) ?? this.blank;
  }

  write(position: number, symbol: string): void {
    if (symbol === this.blank) this.cells.delete(position);
    else this.cells.set(position, symbol);
  }

  bounds(): [number, number] | null {
    if (this.cells.size === 0) return null;
    let low = Infinity;
    let high = -Infinity;
    for (const position of this.cells.keys()) {
      low = Math.min(low, position);
      high = Math.max(high, position);
    }
    return [low, high];
  }

  window(head: number): { offset: number; cells: string } {
    const b = this.bounds();
    const low = b ? Math.min(b[0], head) : head;
    const high = b ? Math.max(b[1], head) : head;
    let cells = "";
    for (let i = low; i <= high; i++) cells += this.read(i);
    return { offset: low, cells };
  }

  content(): string {
    const b = this.bounds();
    if (!b) return "";
    let out = "";
    for (let i = b[0]; i <= b[1]; i++) out += this.read(i);
    return out;
  }
}
