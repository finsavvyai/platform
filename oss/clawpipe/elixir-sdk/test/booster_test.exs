defmodule ClawPipe.BoosterTest do
  use ExUnit.Case, async: true

  alias ClawPipe.Booster

  # ---------------------------------------------------------------------------
  # Rule 1 — Math
  # ---------------------------------------------------------------------------

  describe "math rule" do
    test "resolves simple addition" do
      assert {:ok, "4"} = Booster.boost("what is 2 + 2")
    end

    test "resolves multiplication" do
      assert {:ok, "42"} = Booster.boost("calculate 6 * 7")
    end

    test "resolves floating point and returns integer when whole" do
      assert {:ok, "8"} = Booster.boost("compute 4.0 * 2")
    end

    test "resolves parenthesised expression" do
      assert {:ok, "10"} = Booster.boost("evaluate (2 + 3) * 2")
    end

    test "skips non-numeric expression" do
      assert :skip = Booster.boost("what is the capital of France")
    end
  end

  # ---------------------------------------------------------------------------
  # Rule 2 — Date
  # ---------------------------------------------------------------------------

  describe "date rule" do
    test "returns ISO date for 'what is today'" do
      {:ok, result} = Booster.boost("what is today")
      assert Regex.match?(~r/^\d{4}-\d{2}-\d{2}$/, result)
    end

    test "matches 'current date'" do
      {:ok, result} = Booster.boost("current date")
      assert Regex.match?(~r/^\d{4}-\d{2}-\d{2}$/, result)
    end

    test "matches 'what day is today'" do
      {:ok, result} = Booster.boost("what day is today")
      assert Regex.match?(~r/^\d{4}-\d{2}-\d{2}$/, result)
    end

    test "skips long date-like sentences" do
      long = "I am wondering what day is today because I need to schedule a very important meeting and I am confused"
      assert :skip = Booster.boost(long)
    end
  end

  # ---------------------------------------------------------------------------
  # Rule 3 — UUID
  # ---------------------------------------------------------------------------

  describe "uuid rule" do
    test "generates a UUID" do
      {:ok, uuid} = Booster.boost("generate a uuid")
      assert Regex.match?(~r/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, uuid)
    end

    test "generates different UUIDs on successive calls" do
      {:ok, uuid1} = Booster.boost("generate a uuid")
      {:ok, uuid2} = Booster.boost("generate a uuid")
      refute uuid1 == uuid2
    end

    test "matches 'generate uuid' without 'a'" do
      {:ok, uuid} = Booster.boost("generate uuid")
      assert String.length(uuid) == 36
    end
  end

  # ---------------------------------------------------------------------------
  # Rule 4 — Uppercase
  # ---------------------------------------------------------------------------

  describe "uppercase rule" do
    test "converts quoted word to uppercase" do
      assert {:ok, "HELLO"} = Booster.boost(~s|convert "hello" to uppercase|)
    end

    test "converts unquoted word to uppercase" do
      assert {:ok, "WORLD"} = Booster.boost("convert world to uppercase")
    end

    test "converts multi-word phrase to uppercase" do
      assert {:ok, "FOO BAR"} = Booster.boost("convert foo bar to uppercase")
    end
  end

  # ---------------------------------------------------------------------------
  # Rule 5 — Lowercase
  # ---------------------------------------------------------------------------

  describe "lowercase rule" do
    test "converts quoted word to lowercase" do
      assert {:ok, "hello"} = Booster.boost(~s|convert "HELLO" to lowercase|)
    end

    test "converts mixed-case string to lowercase" do
      assert {:ok, "mixedcase"} = Booster.boost("convert MixedCase to lowercase")
    end
  end

  # ---------------------------------------------------------------------------
  # Rule 6 — Reverse
  # ---------------------------------------------------------------------------

  describe "reverse rule" do
    test "reverses a quoted word" do
      assert {:ok, "olleh"} = Booster.boost(~s|reverse "hello"|)
    end

    test "reverses a plain word" do
      assert {:ok, "dlrow"} = Booster.boost("reverse world")
    end

    test "reverses a multi-character string" do
      assert {:ok, "cba"} = Booster.boost("reverse abc")
    end
  end

  # ---------------------------------------------------------------------------
  # No-match
  # ---------------------------------------------------------------------------

  describe "no matching rule" do
    test "returns :skip for an arbitrary prompt" do
      assert :skip = Booster.boost("Write me a poem about the sea")
    end

    test "returns :skip for empty-ish input" do
      assert :skip = Booster.boost("   ")
    end
  end
end
