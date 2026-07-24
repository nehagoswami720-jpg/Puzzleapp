/**
 * A safe arithmetic-expression evaluator for the number games. Supports
 * + - * / ( ) and integer literals only — never `eval`. Returns the value and
 * the integer literals used, so make-the-target can verify the player used the
 * given numbers exactly once each.
 */
export interface EvalResult {
  value: number;
  /** integer literals encountered, in order */
  numbers: number[];
}

class Parser {
  private i = 0;
  readonly numbers: number[] = [];
  constructor(private readonly s: string) {}

  private peek(): string {
    while (this.s[this.i] === ' ') this.i++;
    return this.s[this.i] ?? '';
  }
  private next(): string {
    this.peek();
    return this.s[this.i++] ?? '';
  }

  parse(): number {
    const v = this.expr();
    if (this.peek() !== '') throw new Error('unexpected trailing input');
    return v;
  }
  private expr(): number {
    let v = this.term();
    for (;;) {
      const op = this.peek();
      if (op === '+' || op === '-') {
        this.next();
        const r = this.term();
        v = op === '+' ? v + r : v - r;
      } else return v;
    }
  }
  private term(): number {
    let v = this.factor();
    for (;;) {
      const op = this.peek();
      if (op === '*' || op === '/') {
        this.next();
        const r = this.factor();
        if (op === '/') {
          if (r === 0) throw new Error('division by zero');
          v = v / r;
        } else v = v * r;
      } else return v;
    }
  }
  private factor(): number {
    const c = this.peek();
    if (c === '(') {
      this.next();
      const v = this.expr();
      if (this.next() !== ')') throw new Error('missing )');
      return v;
    }
    if (c === '-') {
      this.next();
      return -this.factor();
    }
    if (c >= '0' && c <= '9') {
      let num = '';
      while (this.peek() >= '0' && this.peek() <= '9') num += this.next();
      const n = parseInt(num, 10);
      this.numbers.push(n);
      return n;
    }
    throw new Error(`unexpected "${c || 'end'}"`);
  }
}

/** Evaluate, or throw on any malformed / disallowed input. */
export function evaluate(expr: string): EvalResult {
  if (!/^[\d+\-*/()×÷.\s]*$/.test(expr)) throw new Error('only numbers and + - * / ( ) allowed');
  const normalized = expr.replace(/×/g, '*').replace(/÷/g, '/');
  const p = new Parser(normalized);
  const value = p.parse();
  if (!Number.isFinite(value)) throw new Error('not a finite value');
  return { value, numbers: p.numbers };
}

const sortNums = (a: number[]) => [...a].sort((x, y) => x - y);

/** Does `expr` use exactly `given` (as a multiset) and evaluate to `target`? */
export function checkTarget(
  expr: string,
  given: number[],
  target: number,
): { ok: boolean; reason?: string } {
  let res: EvalResult;
  try {
    res = evaluate(expr);
  } catch (e) {
    return { ok: false, reason: `That expression didn't parse (${(e as Error).message}).` };
  }
  const used = sortNums(res.numbers);
  const want = sortNums(given);
  if (used.length !== want.length || used.some((n, i) => n !== want[i])) {
    return { ok: false, reason: `Use each of ${given.join(', ')} exactly once.` };
  }
  if (Math.abs(res.value - target) > 1e-6) {
    return { ok: false, reason: `That comes to ${Math.round(res.value * 100) / 100}, not ${target}.` };
  }
  return { ok: true };
}
