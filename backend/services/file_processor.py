from pathlib import Path
from typing import Any, Sequence
from uuid import uuid4

from langchain_core.documents import Document
from langchain_community.document_loaders import PyMuPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

from backend.services.interface.file_processor import FileProcessorInterface
from backend.utils.logging_config import get_logger

logger = get_logger(__name__)


class FileProcessor(FileProcessorInterface):
    """
    Load and chunk documents for the RAG pipeline.

    Primary path uses ``unstructured`` to perform layout-aware partitioning
    (titles, sections, tables as Markdown). If ``unstructured`` raises or
    returns nothing for an unsupported / unusual file, we transparently
    fall back to the legacy :class:`PyMuPDFLoader` / :class:`TextLoader`
    pipeline so the user never sees a 500.
    """

    def __init__(
        self,
        file_path: str,
        chunk_size: int = 900,
        chunk_overlap: int = 100,
        page_chunk_size: int = 10,
        strategy: str = "fast",
        infer_table_structure: bool = True,
        include_page_breaks: bool = False,
        languages: Sequence[str] = ("eng",),
    ):
        """
        :param file_path: Path to the uploaded file.
        :param chunk_size: Maximum characters per chunk (used by both paths).
        :param chunk_overlap: Overlap between adjacent chunks.
        :param page_chunk_size: Legacy knob; only used by the PyMuPDF fallback.
        :param strategy: ``unstructured`` partitioning strategy. Defaults to
            ``"fast"`` (no OCR) so it works in a stock install. Use
            ``"hi_res"`` if you've installed ``unstructured_pytesseract``
            and want layout-aware table detection; this is slower at
            ingestion time.
        :param infer_table_structure: When True, parse tables into HTML for
            conversion to Markdown.
        :param include_page_breaks: Pass-through to ``unstructured``;
            default False to avoid page-break artefacts in embeddings.
        :param languages: Document languages; expands when Bangla support lands.
        """
        self.file_path = file_path
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.page_chunk_size = page_chunk_size
        self.strategy = strategy
        self.infer_table_structure = infer_table_structure
        self.include_page_breaks = include_page_breaks
        self.languages = list(languages)

        self._supported_exts = (".pdf", ".txt")

    # ------------------------------------------------------------------ #
    # Public entry point (interface contract)
    # ------------------------------------------------------------------ #
    def process(self) -> Sequence[Any]:
        """Load and chunk the file. Returns a list of ``langchain`` Documents."""
        logger.info("Starting file processing for %s", self.file_path)

        ext = Path(self.file_path).suffix.lower()
        if ext not in self._supported_exts:
            logger.error("Unsupported file type encountered: %s", self.file_path)
            raise ValueError(f"Unsupported file type: {self.file_path}")

        # Preferred path: layout-aware partitioning via unstructured.
        try:
            docs = self._extract_with_unstructured()
            if docs:
                logger.info(
                    "unstructured produced %d chunks for %s",
                    len(docs),
                    self.file_path,
                )
                return docs
            logger.warning(
                "unstructured returned no chunks for %s; falling back to PyMuPDF/TextLoader.",
                self.file_path,
            )
        except Exception:
            logger.exception(
                "unstructured extraction failed for %s; falling back to PyMuPDF/TextLoader.",
                self.file_path,
            )

        return self._extract_with_pymupdf()

    # ------------------------------------------------------------------ #
    # Primary path: unstructured
    # ------------------------------------------------------------------ #
    def _extract_with_unstructured(self) -> Sequence[Document]:
        """Partition with ``unstructured`` then chunk by title."""
        from unstructured.chunking.title import chunk_by_title
        from unstructured.partition.pdf import partition_pdf
        from unstructured.partition.text import partition_text

        ext = Path(self.file_path).suffix.lower()

        if ext == ".pdf":
            elements = partition_pdf(
                filename=self.file_path,
                strategy=self.strategy,
                infer_table_structure=self.infer_table_structure,
                include_page_breaks=self.include_page_breaks,
                languages=self.languages,
            )
            logger.info(
                "partition_pdf yielded %d raw elements (strategy=%s, infer_table_structure=%s)",
                len(elements),
                self.strategy,
                self.infer_table_structure,
            )
        elif ext == ".txt":
            elements = partition_text(filename=self.file_path, languages=self.languages)
            logger.info("partition_text yielded %d raw elements", len(elements))
        else:
            # Should be unreachable thanks to the guard in ``process``.
            raise ValueError(f"Unsupported file type: {self.file_path}")

        if not elements:
            return []

        chunked = chunk_by_title(
            elements,
            max_characters=self.chunk_size,
            new_after_n_chars=max(self.chunk_size - self.chunk_overlap, 1),
            combine_text_under_n_chars=self.chunk_overlap,
        )
        logger.info("chunk_by_title produced %d chunks", len(chunked))

        source_name = Path(self.file_path).name
        docs: list[Document] = []
        for el in chunked:
            text = self._render_element_markdown(el).strip()
            if not text:
                continue
            page_number = self._safe_page_number(el)
            category = getattr(el, "category", None) or type(el).__name__

            docs.append(
                Document(
                    page_content=text,
                    metadata={
                        "source": source_name,
                        "page": page_number,
                        "element_type": category,
                        "chunk_id": uuid4().hex,
                    },
                )
            )
        return docs

    def _render_element_markdown(self, element: Any) -> str:
        """
        Render an ``unstructured`` element to the text that will be embedded.

        Tables are converted from the parsed HTML representation into Markdown
        so downstream prompts and the frontend's ``react-markdown`` see proper
        pipe-style tables. Other element types pass through verbatim.
        """
        category = getattr(element, "category", "")
        text = getattr(element, "text", "") or ""

        if category != "Table":
            return text

        html = None
        meta = getattr(element, "metadata", None)
        if meta is not None:
            html = getattr(meta, "text_as_html", None)

        if not html:
            return text

        return self._html_table_to_markdown(html)

    @staticmethod
    def _html_table_to_markdown(html: str) -> str:
        """
        Convert a simple HTML table (``<table><tr><th|td>``) to a Markdown
        table. Anything outside the table tags is left untouched.

        Multi-row headers (i.e. a header that itself spans multiple ``<tr>``s
        with only ``<th>`` cells) are collapsed into a single header row.
        """
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            logger.warning(
                "beautifulsoup4 is required for HTML->Markdown table conversion; "
                "install `beautifulsoup4` to render tables as Markdown."
            )
            return html

        soup = BeautifulSoup(html, "html.parser")
        table = soup.find("table")
        if table is None:
            return html

        rows: list[list[str]] = []
        for tr in table.find_all("tr"):
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["th", "td"])]
            if any(cells):
                rows.append(cells)

        if not rows:
            return html

        header = rows[0]
        body = rows[1:] if len(rows) > 1 else []
        width = max(len(header), *(len(r) for r in body)) if body else len(header)

        def _pad(row: list[str]) -> list[str]:
            return row + [""] * (width - len(row))

        md = ["| " + " | ".join(_pad(header)) + " |"]
        md.append("| " + " | ".join(["---"] * width) + " |")
        for row in body:
            md.append("| " + " | ".join(_pad(row)) + " |")
        return "\n".join(md)

    @staticmethod
    def _safe_page_number(element: Any) -> int | None:
        """Best-effort page number from an unstructured element's metadata."""
        meta = getattr(element, "metadata", None)
        if meta is None:
            return None
        for attr in ("page_number", "page", "page_index"):
            value = getattr(meta, attr, None)
            if isinstance(value, int):
                return value
            if isinstance(value, str) and value.isdigit():
                return int(value)
        return None

    # ------------------------------------------------------------------ #
    # Fallback path: legacy PyMuPDF / TextLoader
    # ------------------------------------------------------------------ #
    def _extract_with_pymupdf(self) -> Sequence[Any]:
        """Original loader+chunker; kept verbatim for the fallback path."""
        logger.info("Falling back to PyMuPDF/TextLoader for %s", self.file_path)

        try:
            if self.file_path.lower().endswith(".pdf"):
                loader = PyMuPDFLoader(self.file_path, mode="page")
                logger.info("Initialized PyMuPDFLoader for %s", self.file_path)
            elif self.file_path.lower().endswith(".txt"):
                loader = TextLoader(self.file_path, encoding="utf-8")
                logger.info("Initialized TextLoader for %s", self.file_path)
            else:
                logger.error("Unsupported file type encountered: %s", self.file_path)
                raise ValueError(f"Unsupported file type: {self.file_path}")

            loaded_pages = loader.load()
            documents = []
            for i in range(0, len(loaded_pages), self.page_chunk_size):
                chunk = loaded_pages[i : i + self.page_chunk_size]
                documents.extend(chunk)
                logger.info("Loaded pages %d to %d", i + 1, i + len(chunk))

            logger.info(
                "Loaded %d raw document segments from %s (fallback path)",
                len(documents),
                self.file_path,
            )

            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
            )
            chunks = text_splitter.split_documents(documents)

            # Backfill chunk metadata so downstream consumers (the vector
            # store, future citations) get a consistent shape across paths.
            source_name = Path(self.file_path).name
            for doc in chunks:
                doc.metadata.setdefault("source", source_name)
                doc.metadata.setdefault("chunk_id", uuid4().hex)
                page = doc.metadata.get("page")
                if page is not None and not isinstance(page, int):
                    try:
                        doc.metadata["page"] = int(page)
                    except (TypeError, ValueError):
                        doc.metadata["page"] = None

            logger.info(
                "Split documents into %d chunks for %s (fallback path)",
                len(chunks),
                self.file_path,
            )
            return chunks
        except Exception:
            logger.exception(
                "Failed while processing file %s (fallback path)", self.file_path
            )
            raise
