def test_chat_no_context_anti_hallucination(client):
    # No documents uploaded
    res = client.post("/api/chat", json={
        "query": "What is quantum gravity?",
        "mode": "ask",
        "source_mode": "documents_only"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_grounded"] is False
    assert "couldn't find this information" in data["answer"].lower()
    assert len(data["document_sources"]) == 0


def test_chat_grounded_ask_mode(client, sample_txt_bytes):
    # Upload document
    upload_res = client.post(
        "/api/documents/upload",
        files=[("files", ("physics_notes.txt", sample_txt_bytes, "text/plain"))]
    )
    assert upload_res.status_code == 201

    res = client.post("/api/chat", json={
        "query": "Who discovered electromagnetic induction?",
        "mode": "ask",
        "source_mode": "documents_only"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_grounded"] is True
    assert len(data["document_sources"]) > 0
    assert "conversation_id" in data
    assert data["mode"] == "ask"


def test_chat_explain_modes(client, sample_txt_bytes):
    client.post(
        "/api/documents/upload",
        files=[("files", ("physics_notes.txt", sample_txt_bytes, "text/plain"))]
    )

    for style in ["normal", "simple", "step_by_step"]:
        res = client.post("/api/chat", json={
            "query": "Explain electromagnetic induction",
            "mode": "explain",
            "explanation_style": style,
            "source_mode": "documents_only"
        })
        assert res.status_code == 200
        assert res.json()["mode"] == "explain"


def test_chat_summarize_and_compare(client, sample_txt_bytes):
    client.post(
        "/api/documents/upload",
        files=[("files", ("doc1.txt", sample_txt_bytes, "text/plain"))]
    )

    # Summarize
    sum_res = client.post("/api/chat", json={
        "query": "Summarize key laws in the document",
        "mode": "summarize",
        "source_mode": "documents_only"
    })
    assert sum_res.status_code == 200
    assert sum_res.json()["mode"] == "summarize"

    # Compare
    comp_res = client.post("/api/chat", json={
        "query": "Compare Faraday's law and Lenz's law",
        "mode": "compare",
        "source_mode": "documents_only"
    })
    assert comp_res.status_code == 200
    assert comp_res.json()["mode"] == "compare"


def test_chat_evidence_mode(client, sample_txt_bytes):
    client.post(
        "/api/documents/upload",
        files=[("files", ("doc1.txt", sample_txt_bytes, "text/plain"))]
    )

    res = client.post("/api/chat", json={
        "query": "Find evidence of Faraday's discovery in 1831",
        "mode": "evidence",
        "source_mode": "documents_only"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "evidence"
    assert "structured_data" in data


def test_conversational_history(client, sample_txt_bytes):
    client.post(
        "/api/documents/upload",
        files=[("files", ("doc1.txt", sample_txt_bytes, "text/plain"))]
    )

    # Turn 1
    res1 = client.post("/api/chat", json={
        "query": "What is electromagnetic induction?",
        "mode": "ask"
    })
    conv_id = res1.json()["conversation_id"]

    # Turn 2
    res2 = client.post("/api/chat", json={
        "query": "Explain that more simply",
        "conversation_id": conv_id,
        "mode": "explain",
        "explanation_style": "simple"
    })
    assert res2.status_code == 200

    # Check history endpoint
    hist_res = client.get(f"/api/chat/history/{conv_id}")
    assert hist_res.status_code == 200
    messages = hist_res.json()["messages"]
    assert len(messages) >= 4  # 2 user + 2 assistant messages


def test_web_search_modes(client, sample_txt_bytes):
    client.post(
        "/api/documents/upload",
        files=[("files", ("doc1.txt", sample_txt_bytes, "text/plain"))]
    )

    # web_only mode
    res_web = client.post("/api/chat", json={
        "query": "Latest 2026 developments in physics",
        "mode": "ask",
        "source_mode": "web_only"
    })
    assert res_web.status_code == 200
    data = res_web.json()
    assert len(data["web_sources"]) > 0
    assert len(data["document_sources"]) == 0

    # documents_and_web mode
    res_both = client.post("/api/chat", json={
        "query": "Electromagnetic applications",
        "mode": "ask",
        "source_mode": "documents_and_web"
    })
    assert res_both.status_code == 200
    data_both = res_both.json()
    assert len(data_both["document_sources"]) > 0
    assert len(data_both["web_sources"]) > 0
