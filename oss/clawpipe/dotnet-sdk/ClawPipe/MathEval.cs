namespace ClawPipe;

/// <summary>
/// Safe math expression evaluator supporting +, -, *, /, (, ) on numeric literals.
/// No reflection, no compilation — pure recursive descent parser.
/// </summary>
internal static class MathEval
{
    /// <summary>Evaluate a numeric expression string. Throws on invalid input.</summary>
    public static double Evaluate(string expression)
    {
        var ctx = new Parser(expression.Replace("^", "").Trim());
        var result = ctx.ParseExpr();
        if (ctx.HasMore) throw new FormatException($"Unexpected token at position {ctx.Pos}");
        return result;
    }

    private sealed class Parser(string input)
    {
        private readonly string _input = input;
        public int Pos { get; private set; } = 0;
        public bool HasMore => Pos < _input.Length;

        // expr = term (('+' | '-') term)*
        public double ParseExpr()
        {
            var left = ParseTerm();
            while (HasMore)
            {
                SkipWhitespace();
                if (!HasMore) break;
                var ch = _input[Pos];
                if (ch == '+') { Pos++; left += ParseTerm(); }
                else if (ch == '-') { Pos++; left -= ParseTerm(); }
                else break;
            }
            return left;
        }

        // term = factor (('*' | '/') factor)*
        private double ParseTerm()
        {
            var left = ParseFactor();
            while (HasMore)
            {
                SkipWhitespace();
                if (!HasMore) break;
                var ch = _input[Pos];
                if (ch == '*') { Pos++; left *= ParseFactor(); }
                else if (ch == '/') { Pos++; left /= ParseFactor(); }
                else break;
            }
            return left;
        }

        // factor = number | '(' expr ')' | '-' factor
        private double ParseFactor()
        {
            SkipWhitespace();
            if (!HasMore) throw new FormatException("Unexpected end of expression");

            if (_input[Pos] == '(')
            {
                Pos++;
                var val = ParseExpr();
                SkipWhitespace();
                if (!HasMore || _input[Pos] != ')')
                    throw new FormatException("Missing closing parenthesis");
                Pos++;
                return val;
            }

            if (_input[Pos] == '-')
            {
                Pos++;
                return -ParseFactor();
            }

            return ParseNumber();
        }

        private double ParseNumber()
        {
            SkipWhitespace();
            var start = Pos;
            while (HasMore && (char.IsDigit(_input[Pos]) || _input[Pos] == '.' || _input[Pos] == '%'))
                Pos++;

            if (Pos == start) throw new FormatException($"Expected number at position {Pos}");

            var raw = _input[start..Pos];
            if (raw.EndsWith('%'))
                return double.Parse(raw[..^1]) / 100.0;
            return double.Parse(raw, System.Globalization.CultureInfo.InvariantCulture);
        }

        private void SkipWhitespace()
        {
            while (HasMore && _input[Pos] == ' ') Pos++;
        }
    }
}
