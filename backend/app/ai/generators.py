import json
import re
from typing import Any, Dict, List, Optional
from langchain_core.language_models.chat_models import BaseChatModel
from app.ai.prompts import QUIZ_PROMPT, FLASHCARD_PROMPT, build_context_block
from app.core.logging import logger


def clean_json_text(raw_text: str) -> str:
    """Extracts clean JSON substring from model output, stripping markdown code fences."""
    raw = raw_text.strip()
    # Match markdown code block ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if match:
        return match.group(1).strip()
    return raw


def parse_json_safely(raw_text: str) -> Optional[Dict[str, Any]]:
    """Tries parsing JSON safely from raw text."""
    cleaned = clean_json_text(raw_text)
    try:
        return json.loads(cleaned)
    except Exception:
        # Try finding outermost { ... }
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except Exception:
                pass
    return None


_DOCUMENT_CENTRIC_PHRASES = (
    "according to the document",
    "according to the pdf",
    "what is the document about",
    "what is this document about",
    "what does the document say",
    "what does the pdf say",
    "what is mentioned in the document",
    "what is mentioned in the pdf",
)


def _has_document_centric_question(text: str) -> bool:
    normalized = " ".join(text.lower().split())
    return any(phrase in normalized for phrase in _DOCUMENT_CENTRIC_PHRASES)


def _validated_quiz(parsed: Optional[Dict[str, Any]], question_count: int) -> Optional[Dict[str, Any]]:
    if not parsed or not isinstance(parsed.get("questions"), list):
        return None

    questions = parsed["questions"]
    if len(questions) != question_count:
        return None

    seen_questions = set()
    for index, question in enumerate(questions, 1):
        if not isinstance(question, dict):
            return None
        stem = question.get("question")
        options = question.get("options")
        correct = question.get("correct_answer")
        explanation = question.get("explanation")
        if not all(isinstance(value, str) and value.strip() for value in (stem, correct, explanation)):
            return None
        if _has_document_centric_question(stem):
            return None
        if not isinstance(options, list) or len(options) != 4 or not all(
            isinstance(option, str) and option.strip() for option in options
        ):
            return None
        normalized_options = [" ".join(option.lower().split()) for option in options]
        if len(set(normalized_options)) != 4:
            return None
        if correct.strip() not in [option.strip() for option in options]:
            return None

        normalized_stem = " ".join(stem.lower().split())
        if normalized_stem in seen_questions:
            return None
        seen_questions.add(normalized_stem)
        question["question_id"] = index
        question["options"] = [option.strip() for option in options]
        question["correct_answer"] = correct.strip()
        question["explanation"] = explanation.strip()

    parsed["questions"] = questions
    return parsed


def _validated_flashcards(parsed: Optional[Dict[str, Any]], count: int) -> Optional[Dict[str, Any]]:
    if not parsed or not isinstance(parsed.get("cards"), list):
        return None

    cards = parsed["cards"]
    if len(cards) != count:
        return None

    seen_questions = set()
    seen_answers = set()
    for card in cards:
        if not isinstance(card, dict):
            return None
        question = card.get("question")
        answer = card.get("answer")
        if not isinstance(question, str) or not question.strip():
            return None
        if not isinstance(answer, str) or not answer.strip():
            return None
        if _has_document_centric_question(question):
            return None
        normalized_question = " ".join(question.lower().split())
        normalized_answer = " ".join(answer.lower().split())
        if normalized_question in seen_questions or normalized_answer in seen_answers:
            return None
        seen_questions.add(normalized_question)
        seen_answers.add(normalized_answer)
        card["question"] = question.strip()
        card["answer"] = answer.strip()

    parsed["cards"] = cards
    return parsed


class StructuredGenerators:
    @staticmethod
    def generate_quiz_content(
        llm: BaseChatModel,
        snippets: List[dict],
        question_count: int = 5,
        difficulty: str = "medium"
    ) -> Dict[str, Any]:
        """Generates quiz JSON with options and answers from snippets."""
        context_str = build_context_block(snippets)
        prompt_str = QUIZ_PROMPT.format(
            question_count=question_count,
            difficulty=difficulty,
            context=context_str
        )
        
        try:
            response = llm.invoke(prompt_str)
            parsed = parse_json_safely(response.content)
            validated = _validated_quiz(parsed, question_count)
            if validated:
                return validated

            retry_prompt = (
                prompt_str
                + "\n\nFINAL OUTPUT CHECK: Regenerate the quiz as JSON only. It must contain exactly "
                + str(question_count)
                + " unique concept-focused questions; every question must have four distinct options, "
                + "and correct_answer must exactly match one option. Do not ask about the document itself."
            )
            retry_response = llm.invoke(retry_prompt)
            validated = _validated_quiz(parse_json_safely(retry_response.content), question_count)
            if validated:
                return validated
        except Exception as e:
            logger.warning(f"LLM quiz generation failed or returned invalid JSON: {e}")

        # Deterministic fallback stays focused on the subject matter instead
        # of asking document-centric questions when the model is unavailable.
        logger.info("Using deterministic fallback quiz generator based on document snippets.")
        fallback_questions = []
        question_stems = {
            "easy": "Which statement best expresses the central concept?",
            "medium": "Which interpretation best explains the relationship described by this principle?",
            "hard": "Which conclusion is best supported by the principle and its stated conditions?",
        }
        for idx, s in enumerate(snippets[:question_count], 1):
            text = s.get("snippet", "")
            first_sentence = text.split(".")[0] if "." in text else text[:180]
            first_sentence = first_sentence.strip()
            fallback_questions.append({
                "question_id": idx,
                "question": f"{question_stems.get(difficulty, question_stems['medium'])} {first_sentence}",
                "options": [
                    f"A) {first_sentence}",
                    "B) The stated result is independent of the condition or mechanism described.",
                    "C) The relationship works in the opposite direction from the one described.",
                    "D) The principle applies only when its stated condition is absent."
                ],
                "correct_answer": f"A) {first_sentence.strip()}",
                "explanation": f"The excerpt supports this concept: '{text[:220]}'.",
                "document_name": s.get("filename"),
                "page_number": s.get("page_number", 1),
                "source_snippet": text[:200]
            })

        return {
            "title": "StudyVault Grounded Quiz",
            "questions": fallback_questions
        }

    @staticmethod
    def generate_flashcards_content(
        llm: BaseChatModel,
        snippets: List[dict],
        count: int = 10,
        difficulty: str = "medium"
    ) -> Dict[str, Any]:
        """Generates flashcard JSON from snippets."""
        context_str = build_context_block(snippets)
        prompt_str = FLASHCARD_PROMPT.format(
            count=count,
            difficulty=difficulty,
            context=context_str
        )

        try:
            response = llm.invoke(prompt_str)
            parsed = parse_json_safely(response.content)
            validated = _validated_flashcards(parsed, count)
            if validated:
                return validated

            retry_prompt = (
                prompt_str
                + "\n\nFINAL OUTPUT CHECK: Regenerate as JSON only with exactly "
                + str(count)
                + " unique concept-focused cards. Every card must have a specific question and a concise, "
                + "supported answer. Do not ask about the document itself."
            )
            retry_response = llm.invoke(retry_prompt)
            validated = _validated_flashcards(parse_json_safely(retry_response.content), count)
            if validated:
                return validated
        except Exception as e:
            logger.warning(f"LLM flashcard generation failed or returned invalid JSON: {e}")

        # Deterministic fallback flashcards should still test the concepts,
        # never the name or existence of the source document.
        logger.info("Using deterministic fallback flashcard generator based on document snippets.")
        fallback_cards = []
        question_stems = {
            "easy": "Explain this central concept in your own words:",
            "medium": "What relationship or mechanism does this concept describe, and how does it work?",
            "hard": "What conclusion follows from this principle, and which stated condition supports it?",
        }
        for idx, s in enumerate(snippets[:count], 1):
            text = s.get("snippet", "").strip()
            sentences = [sentence.strip() for sentence in text.split(".") if len(sentence.strip()) > 15]
            concept_statement = sentences[0] if sentences else text[:180]
            a = text[:500]
            
            fallback_cards.append({
                "question": f"{question_stems.get(difficulty, question_stems['medium'])} {concept_statement}",
                "answer": a,
                "document_name": s.get("filename"),
                "page_number": s.get("page_number", 1),
                "source_snippet": text[:200]
            })

        return {
            "title": "StudyVault Flashcard Deck",
            "cards": fallback_cards
        }
