def test_flashcard_flow(client, sample_txt_bytes):
    # Upload document
    client.post(
        "/api/documents/upload",
        files=[("files", ("physics.txt", sample_txt_bytes, "text/plain"))]
    )

    # 1. Generate flashcards
    gen_res = client.post("/api/flashcards/generate", json={
        "count": 5,
        "difficulty": "medium"
    })
    assert gen_res.status_code == 201
    set_data = gen_res.json()
    assert "id" in set_data
    assert len(set_data["cards"]) > 0
    card_id = set_data["cards"][0]["id"]
    set_id = set_data["id"]

    # 2. List flashcard sets
    list_res = client.get("/api/flashcards")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Get flashcard set
    get_res = client.get(f"/api/flashcards/{set_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == set_id

    # 4. Review card
    rev_res = client.post(f"/api/flashcards/{card_id}/review", json={
        "status": "known"
    })
    assert rev_res.status_code == 200
    assert rev_res.json()["review_status"] == "known"

    # 5. Delete deck
    del_res = client.delete(f"/api/flashcards/{set_id}")
    assert del_res.status_code == 200
