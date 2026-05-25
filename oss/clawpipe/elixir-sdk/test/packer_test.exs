defmodule ClawPipe.PackerTest do
  use ExUnit.Case, async: true

  alias ClawPipe.Packer

  # ---------------------------------------------------------------------------
  # Basic pack/2
  # ---------------------------------------------------------------------------

  describe "pack/2" do
    test "returns a map with :text and :savings_pct keys" do
      result = Packer.pack("Hello world")
      assert is_map(result)
      assert Map.has_key?(result, :text)
      assert Map.has_key?(result, :savings_pct)
    end

    test "passes through short text unchanged" do
      result = Packer.pack("Short text")
      assert result.text == "Short text"
      assert result.savings_pct == 0.0
    end

    test "savings_pct is zero when nothing is removed" do
      result = Packer.pack("Hello world", compress_whitespace: false, deduplication: false, strip_boilerplate: false)
      assert result.savings_pct == 0.0
    end
  end

  # ---------------------------------------------------------------------------
  # Whitespace compression
  # ---------------------------------------------------------------------------

  describe "whitespace compression" do
    test "collapses more than two consecutive blank lines" do
      text = "line1\n\n\n\n\nline2"
      result = Packer.pack(text, deduplication: false, strip_boilerplate: false)
      assert result.text == "line1\n\nline2"
    end

    test "strips trailing whitespace from each line" do
      text = "line1   \nline2  "
      result = Packer.pack(text, deduplication: false, strip_boilerplate: false)
      assert result.text == "line1\nline2"
    end
  end

  # ---------------------------------------------------------------------------
  # Deduplication
  # ---------------------------------------------------------------------------

  describe "deduplication" do
    test "removes duplicate paragraph blocks longer than 50 chars" do
      block = "This is a longer duplicate paragraph that exceeds fifty chars easily."
      text  = "#{block}\n\nSome other content.\n\n#{block}"
      result = Packer.pack(text, compress_whitespace: false, strip_boilerplate: false)
      # The duplicated block should appear only once
      assert String.split(result.text, block) |> length() == 2
    end

    test "keeps short paragraphs even if duplicated" do
      text = "Hi\n\nHi"
      result = Packer.pack(text, compress_whitespace: false, strip_boilerplate: false)
      assert result.text =~ "Hi"
    end
  end

  # ---------------------------------------------------------------------------
  # Token estimation
  # ---------------------------------------------------------------------------

  describe "estimate_tokens/1" do
    test "returns ceiling of length / 4" do
      assert Packer.estimate_tokens("abcd") == 1
      assert Packer.estimate_tokens("abcde") == 2
      assert Packer.estimate_tokens("") == 0
    end
  end

  # ---------------------------------------------------------------------------
  # System prompt prepend
  # ---------------------------------------------------------------------------

  describe "system option" do
    test "prepends system message before packing" do
      result = Packer.pack("User prompt", system: "You are helpful.")
      assert String.starts_with?(result.text, "You are helpful.")
    end
  end

  # ---------------------------------------------------------------------------
  # Truncation
  # ---------------------------------------------------------------------------

  describe "truncation" do
    test "appends truncation notice when text exceeds budget" do
      long_text = String.duplicate("a", 1000)
      result    = Packer.pack(long_text, max_tokens: 10)
      assert String.ends_with?(result.text, "[Truncated — context exceeded budget]")
    end

    test "does not truncate text within budget" do
      text   = "Short"
      result = Packer.pack(text, max_tokens: 100)
      refute String.contains?(result.text, "Truncated")
    end
  end
end
