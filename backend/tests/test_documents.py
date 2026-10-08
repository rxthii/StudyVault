import io
from pypdf import PdfWriter


def test_upload_txt_document(client, sample_txt_bytes):
    response = client.post(
        "/api/documents/upload",
        files=[("files", ("physics_notes.txt", sample_txt_bytes, "text/plain"))]
    )
    assert response.status_code == 201
    data = response.json()
    assert data["uploaded_count"] == 1
    assert data["failed_count"] == 0
    doc = data["documents"][0]
    assert doc["filename"] == "physics_notes.txt"
    assert doc["status"] == "ready"


def test_upload_invalid_file_type(client):
    response = client.post(
        "/api/documents/upload",
        files=[("files", ("malicious.exe", b"binary content", "application/octet-stream"))]
    )
    assert response.status_code == 201
    data = response.json()
    assert data["failed_count"] == 1
    assert "unsupported" in data["documents"][0]["error_message"].lower()


def test_upload_empty_file(client):
    response = client.post(
        "/api/documents/upload",
        files=[("files", ("empty.txt", b"", "text/plain"))]
    )
    assert response.status_code == 201
    data = response.json()
    assert data["failed_count"] == 1
    assert "empty" in data["documents"][0]["error_message"].lower()


def test_upload_pdf_document(client):
    # Create valid PDF with text using pypdf
    from pypdf import PdfWriter
    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    # We can write bytes or use txt for extraction test
    # In pypdf blank page has no text, so test blank PDF handling:
    stream = io.BytesIO()
    writer.write(stream)
    pdf_bytes = stream.getvalue()

    response = client.post(
        "/api/documents/upload",
        files=[("files", ("lecture1.pdf", pdf_bytes, "application/pdf"))]
    )
    assert response.status_code == 201
    data = response.json()
    # Blank PDF without text triggers empty text error gracefully
    assert data["failed_count"] == 1
    assert "no selectable text" in data["documents"][0]["error_message"].lower()


def test_link_and_unlink_document(client, sample_txt_bytes):
    # Upload document
    upload_res = client.post(
        "/api/documents/upload",
        files=[("files", ("chemistry.txt", sample_txt_bytes, "text/plain"))]
    )
    doc_id = upload_res.json()["documents"][0]["document_id"]

    # Check initially linked
    get_res = client.get(f"/api/documents/{doc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["linked"] is True

    # Unlink document
    unlink_res = client.patch(f"/api/documents/{doc_id}/link", json={"linked": False})
    assert unlink_res.status_code == 200
    assert unlink_res.json()["linked"] is False

    # Verify still in library but unlinked
    list_res = client.get("/api/documents?linked=false")
    assert list_res.status_code == 200
    docs = list_res.json()
    assert any(d["id"] == doc_id for d in docs)

    # Re-link document
    relink_res = client.patch(f"/api/documents/{doc_id}/link", json={"linked": True})
    assert relink_res.status_code == 200
    assert relink_res.json()["linked"] is True


def test_delete_document(client, sample_txt_bytes):
    upload_res = client.post(
        "/api/documents/upload",
        files=[("files", ("bio.txt", sample_txt_bytes, "text/plain"))]
    )
    doc_id = upload_res.json()["documents"][0]["document_id"]

    del_res = client.delete(f"/api/documents/{doc_id}")
    assert del_res.status_code == 200

    # Verify deleted
    get_res = client.get(f"/api/documents/{doc_id}")
    assert get_res.status_code == 404
