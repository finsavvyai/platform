"""Safe math expression evaluator — recursive descent parser.

No eval() or exec(). Supports +, -, *, /, %, ** and parentheses.
"""


def safe_eval_math(expr: str) -> float:
    """Evaluate a math expression safely without eval()."""
    pos = [0]

    def ch() -> str:
        return expr[pos[0]] if pos[0] < len(expr) else ""

    def skip() -> None:
        while ch() == " ":
            pos[0] += 1

    def parse_number() -> float:
        skip()
        num = ""
        if ch() == "-":
            num += "-"
            pos[0] += 1
        while ch() and ch() in "0123456789.":
            num += ch()
            pos[0] += 1
        if not num or num == "-":
            raise ValueError("Expected number")
        return float(num)

    def parse_factor() -> float:
        skip()
        if ch() == "(":
            pos[0] += 1
            val = parse_expr()
            skip()
            if ch() == ")":
                pos[0] += 1
            return val
        return parse_number()

    def parse_power() -> float:
        base = parse_factor()
        skip()
        if expr[pos[0] : pos[0] + 2] == "**":
            pos[0] += 2
            base = base ** parse_power()
        return base

    def parse_term() -> float:
        val = parse_power()
        skip()
        while ch() in ("*", "/", "%"):
            op = ch()
            pos[0] += 1
            if op == "*" and ch() == "*":
                pos[0] -= 1
                break
            right = parse_power()
            if op == "*":
                val *= right
            elif op == "/":
                val /= right
            else:
                val %= right
            skip()
        return val

    def parse_expr() -> float:
        val = parse_term()
        skip()
        while ch() in ("+", "-"):
            op = ch()
            pos[0] += 1
            right = parse_term()
            val = val + right if op == "+" else val - right
            skip()
        return val

    result = parse_expr()
    skip()
    if pos[0] < len(expr):
        raise ValueError("Unexpected character")
    return result
