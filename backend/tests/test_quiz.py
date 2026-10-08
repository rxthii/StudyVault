def test_quiz_flow(client, sample_txt_bytes):
    # Upload document
    client.post(
        "/api/documents/upload",
        files=[("files", ("physics.txt", sample_txt_bytes, "text/plain"))]
    )

    # 1. Generate quiz
    gen_res = client.post("/api/quiz/generate", json={
        "question_count": 3,
        "difficulty": "medium"
    })
    assert gen_res.status_code == 201
    quiz_data = gen_res.json()
    quiz_id = quiz_data["id"]
    assert len(quiz_data["questions"]) > 0

    # 2. Get quiz
    get_res = client.get(f"/api/quiz/{quiz_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == quiz_id
    # Verify student view does NOT expose correct_answer field directly
    first_q = get_res.json()["questions"][0]
    assert "correct_answer" not in first_q

    # 3. Submit quiz answers
    sub_res = client.post(f"/api/quiz/{quiz_id}/submit", json={
        "answers": {
            "1": "A) Electromagnetic induction",
            "2": "B) None"
        }
    })
    assert sub_res.status_code == 200
    eval_data = sub_res.json()
    assert "score" in eval_data
    assert "percentage" in eval_data
    assert len(eval_data["results"]) > 0
    assert "explanation" in eval_data["results"][0]
    assert "source_reference" in eval_data["results"][0]
