def test_retrieval_and_active_document_filtering(client, sample_txt_bytes):
    # Upload document
    upload_res = client.post(
        "/api/documents/upload",
        files=[("files", ("physics.txt", sample_txt_bytes, "text/plain"))]
    )
    doc_id = upload_res.json()["documents"][0]["document_id"]

    # Search while linked
    search_res = client.post("/api/retrieval/search", json={
        "query": "electromagnetic induction discovery",
        "top_k": 3
    })
    assert search_res.status_code == 200
    data = search_res.json()
    assert data["total_found"] > 0
    assert data["results"][0]["document_id"] == doc_id
    assert "relevance_score" in data["results"][0]

    # Unlink document
    client.patch(f"/api/documents/{doc_id}/link", json={"linked": False})

    # Search again: must return 0 results because document is unlinked!
    search_after_unlink = client.post("/api/retrieval/search", json={
        "query": "electromagnetic induction discovery",
        "top_k": 3
    })
    assert search_after_unlink.status_code == 200
    assert search_after_unlink.json()["total_found"] == 0
    assert search_after_unlink.json()["active_documents_count"] == 0


def test_retrieval_stats(client, sample_txt_bytes):
    client.post(
        "/api/documents/upload",
        files=[("files", ("calc.txt", sample_txt_bytes, "text/plain"))]
    )
    res = client.get("/api/retrieval/stats")
    assert res.status_code == 200
    data = res.json()
    assert "index_name" in data
    assert "dimension" in data
    assert data["linked_documents_count"] >= 1
