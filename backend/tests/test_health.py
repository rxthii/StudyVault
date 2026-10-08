def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "StudyVault Backend"


def test_status_endpoint(client):
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["operational", "degraded"]
    assert "database" in data
    assert "pinecone" in data
    assert "llm_configuration" in data
    assert "embedding_configuration" in data
    assert "OPENROUTER_API_KEY" not in str(data)
    assert "PINECONE_API_KEY" not in str(data)
