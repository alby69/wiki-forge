import tempfile
from pathlib import Path
import pytest
import fitz  # PyMuPDF
from scripts.conv2md import convert_pdf

def test_convert_pdf_multimodal_extraction():
    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path = Path(tmpdir) / "test_doc.pdf"
        out_path = Path(tmpdir) / "raw" / "test_doc.md"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        # Create a simple PDF with text and an embedded image
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 50), "Hello Multimodal PDF Document")

        # Create a 10x10 red pixmap image and insert it into PDF page
        pix = fitz.Pixmap(fitz.csRGB, fitz.Rect(0, 0, 10, 10), False)
        pix.clear_with(255)
        page.insert_image(fitz.Rect(100, 100, 200, 200), pixmap=pix)

        doc.save(str(pdf_path))
        doc.close()

        convert_pdf(pdf_path, out_path, use_ocr=False)

        assert out_path.exists()
        md_text = out_path.read_text(encoding="utf-8")
        assert "Hello Multimodal PDF Document" in md_text
        assert "![Immagine estratta da pag. 1](../assets/test_doc_p1_img1." in md_text

        assets_dir = out_path.parent / "assets"
        assert assets_dir.exists()
        images = list(assets_dir.glob("test_doc_p1_img1.*"))
        assert len(images) == 1
