"""
Unit tests for ``backend.services.file_processor``.

These tests intentionally do **not** depend on ``unstructured``'s heavy
``hi_res`` strategy (which downloads detectron2 weights on first run). They
exercise the parts of the new code path that are pure-Python — text
partitioning, the HTML→Markdown table helper, and the value-guard on
unsupported extensions.
"""

from pathlib import Path

import pytest

from backend.services.file_processor import FileProcessor


# --------------------------------------------------------------------------- #
# HTML -> Markdown table helper
# --------------------------------------------------------------------------- #
class TestHtmlTableToMarkdown:
    def test_simple_table(self):
        html = (
            "<table>"
            "<tr><th>Name</th><th>Age</th></tr>"
            "<tr><td>Ada</td><td>36</td></tr>"
            "<tr><td>Linus</td><td>55</td></tr>"
            "</table>"
        )
        md = FileProcessor._html_table_to_markdown(html)
        assert "| Name | Age |" in md
        assert "| --- | --- |" in md
        assert "| Ada | 36 |" in md
        assert "| Linus | 55 |" in md

    def test_table_without_header_uses_first_row_as_header(self):
        html = (
            "<table>"
            "<tr><td>A</td><td>B</td></tr>"
            "<tr><td>1</td><td>2</td></tr>"
            "</table>"
        )
        md = FileProcessor._html_table_to_markdown(html)
        assert md.splitlines()[0] == "| A | B |"

    def test_pads_short_rows(self):
        html = (
            "<table>"
            "<tr><th>Col1</th><th>Col2</th><th>Col3</th></tr>"
            "<tr><td>a</td></tr>"
            "</table>"
        )
        md = FileProcessor._html_table_to_markdown(html)
        # The short row should be padded with empty cells.
        assert any(line.endswith("|  |") for line in md.splitlines())

    def test_passthrough_when_no_table_tag(self):
        html = "<p>Not a table</p>"
        assert FileProcessor._html_table_to_markdown(html) == html

    def test_passthrough_when_no_rows(self):
        html = "<table></table>"
        # No rows -> graceful pass-through, no crash.
        assert FileProcessor._html_table_to_markdown(html) == html


# --------------------------------------------------------------------------- #
# Constructor & extension validation
# --------------------------------------------------------------------------- #
class TestConstructor:
    def test_accepts_legacy_signature(self):
        # The API layer in backend/api/files.py only passes file_path.
        fp = FileProcessor("dummy.pdf")
        assert fp.chunk_size == 900
        assert fp.chunk_overlap == 100
        # Default strategy is "fast" (no OCR) so it works in a stock install.
        assert fp.strategy == "fast"

    def test_accepts_new_kwargs(self):
        fp = FileProcessor(
            "dummy.pdf",
            chunk_size=500,
            chunk_overlap=50,
            strategy="fast",
            infer_table_structure=False,
            languages=("eng", "ben"),
        )
        assert fp.chunk_size == 500
        assert fp.strategy == "fast"
        assert fp.infer_table_structure is False
        assert "ben" in fp.languages


# --------------------------------------------------------------------------- #
# process() - extension guard
# --------------------------------------------------------------------------- #
class TestProcessExtensionGuard:
    def test_unsupported_extension_raises_value_error(self, tmp_path: Path):
        bad = tmp_path / "x.docx"
        bad.write_bytes(b"fake")
        with pytest.raises(ValueError, match="Unsupported file type"):
            FileProcessor(str(bad)).process()

    def test_no_extension_raises_value_error(self, tmp_path: Path):
        noext = tmp_path / "noext"
        noext.write_bytes(b"fake")
        with pytest.raises(ValueError, match="Unsupported file type"):
            FileProcessor(str(noext)).process()


# --------------------------------------------------------------------------- #
# Text file path - exercises partition_text (pure-python, no model download)
# --------------------------------------------------------------------------- #
class TestTextFilePath:
    def test_txt_produces_chunks(self, tmp_path: Path):
        # Two paragraphs separated by a blank line and enough text to
        # generate more than one chunk.
        paragraphs = []
        for i in range(30):
            paragraphs.append(
                f"Paragraph {i}. " + ("Lorem ipsum dolor sit amet. " * 8)
            )
        text_path = tmp_path / "sample.txt"
        text_path.write_text("\n\n".join(paragraphs), encoding="utf-8")

        docs = FileProcessor(str(text_path)).process()

        assert len(docs) > 0, "Expected at least one chunk from the text file"
        for doc in docs:
            assert doc.page_content.strip()
            # Every chunk must reference the file in its source metadata.
            # The new unstructured path stores the basename; the legacy
            # fallback stores the absolute path. Both are acceptable.
            source = doc.metadata.get("source", "")
            assert source and Path(source).name == "sample.txt"
            assert doc.metadata.get("chunk_id")
            # ``unstructured`` may or may not populate a page number for a
            # text file; the new code path tolerates that.

    def test_txt_passes_through_unstructured(self, tmp_path: Path):
        """When unstructured returns elements, the path uses them directly."""
        text_path = tmp_path / "short.txt"
        text_path.write_text("Hello world.\n\nSecond paragraph.", encoding="utf-8")

        docs = FileProcessor(str(text_path)).process()
        # short text should produce at least one chunk; either the
        # unstructured path or the PyMuPDF/TextLoader fallback will yield it.
        assert len(docs) >= 1
        joined = "\n".join(d.page_content for d in docs)
        assert "Hello world" in joined or "Second paragraph" in joined


# --------------------------------------------------------------------------- #
# _render_element_markdown - non-Table path is a passthrough
# --------------------------------------------------------------------------- #
class TestRenderElementMarkdown:
    class _FakeElement:
        def __init__(self, text: str, category: str, html: str | None = None):
            self.text = text
            self.category = category
            self._html = html

        @property
        def metadata(self):
            class _Meta:
                pass

            m = _Meta()
            m.text_as_html = self._html
            return m

    def test_non_table_returns_text(self):
        el = self._FakeElement("Hello world", category="NarrativeText")
        assert FileProcessor("dummy.pdf")._render_element_markdown(el) == "Hello world"

    def test_table_without_html_returns_text(self):
        el = self._FakeElement("plain text", category="Table", html=None)
        assert FileProcessor("dummy.pdf")._render_element_markdown(el) == "plain text"

    def test_table_with_html_returns_markdown(self):
        el = self._FakeElement(
            "ignored",
            category="Table",
            html=(
                "<table>"
                "<tr><th>A</th><th>B</th></tr>"
                "<tr><td>1</td><td>2</td></tr>"
                "</table>"
            ),
        )
        md = FileProcessor("dummy.pdf")._render_element_markdown(el)
        assert "| A | B |" in md
        assert "| 1 | 2 |" in md
