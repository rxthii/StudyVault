def test_not_found_error_format(client):
    res = client.get("/api/documents/non-existent-uuid")
    assert res.status_code == 404
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "DOCUMENT_NOT_FOUND"
    assert "message" in data["error"]


def test_validation_error_format(client):
    # Missing required query field in chat payload
    res = client.post("/api/chat", json={})
    assert res.status_code == 422
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_ERROR"
