import React, { useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Loader2,
  Award,
  Eye,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { generateQuiz, submitQuiz } from '../api/quiz.ts';
import type {
  FlashcardDifficulty,
  Quiz,
  QuizQuestion,
  QuizSubmitResponse,
} from '../types/index.ts';

export const QuizPage: React.FC = () => {
  const { activeDocuments, showToast, openEvidence } = useApp();

  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<QuizSubmitResponse | null>(null);

  // Generation Controls State
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<FlashcardDifficulty>('medium');
  const [generating, setGenerating] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showGenModal, setShowGenModal] = useState<boolean>(false);

  const handleGenerateQuiz = async () => {
    if (activeDocuments.length === 0) {
      showToast('error', 'No active documents! Link documents in library first.');
      return;
    }

    try {
      setGenerating(true);
      const quiz = await generateQuiz({
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : null,
        question_count: questionCount,
        difficulty,
      });

      setCurrentQuiz(quiz);
      setCurrentQuestionIdx(0);
      setUserAnswers({});
      setQuizResults(null);
      setShowGenModal(false);
      showToast('success', `Quiz prepared with ${quiz.questions.length} questions.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to generate quiz.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectAnswer = (questionId: number, option: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [String(questionId)]: option,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!currentQuiz) return;

    try {
      setSubmitting(true);
      const res = await submitQuiz(currentQuiz.id, userAnswers);
      setQuizResults(res);
      showToast('success', `Quiz evaluated: ${res.score}/${res.total_questions} (${res.percentage}%)`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentQ: QuizQuestion | undefined = currentQuiz?.questions[currentQuestionIdx];
  const totalQuestions = currentQuiz?.questions.length || 0;
  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <button
        id="trigger-generate-quiz"
        onClick={() => setShowGenModal(true)}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Adaptive Knowledge Quiz
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Multiple-choice knowledge verification grounded in your course documents.
          </p>
        </div>

        <button
          onClick={() => setShowGenModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs whitespace-nowrap"
        >
          <span>Generate New Quiz</span>
        </button>
      </div>

      {/* Main Viewport */}
      {!currentQuiz ? (
        <div className="p-10 text-center rounded-lg bg-white border border-slate-200 max-w-md mx-auto space-y-3">
          <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No Quiz in Progress</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Generate questions formulated directly from your uploaded materials to test understanding.
          </p>
          <button
            onClick={() => setShowGenModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            <span>Generate Grounded Quiz</span>
          </button>
        </div>
      ) : quizResults ? (
        /* Results View */
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Score Header Card */}
          <div className="p-6 rounded-lg bg-white border border-slate-200 shadow-xs text-center space-y-2.5">
            <div className="inline-flex p-2.5 rounded-md bg-slate-100 text-slate-800 mb-1">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Quiz Evaluation Complete</h3>
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="font-mono text-xl font-bold text-slate-900">
                {quizResults.score} / {quizResults.total_questions}
              </span>
              <span className="text-slate-300">·</span>
              <span className="font-mono font-medium text-slate-700">
                {quizResults.percentage}%
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Every question is verified against original passages in your library.
            </p>

            <div className="pt-3 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setQuizResults(null);
                  setCurrentQuestionIdx(0);
                  setUserAnswers({});
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Quiz</span>
              </button>
              <button
                onClick={() => setShowGenModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
              >
                <span>New Quiz</span>
              </button>
            </div>
          </div>

          {/* Question Breakdown List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Question Breakdown & Sources
            </h4>

            {quizResults.results.map((res, idx) => (
              <div
                key={res.question_id || idx}
                className="p-4 rounded-lg bg-white border border-slate-200 space-y-2.5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    {res.is_correct ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-900">
                      Question {idx + 1}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[11px] font-medium ${
                      res.is_correct ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {res.is_correct ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                <div className="text-xs sm:text-sm font-medium text-slate-900 leading-snug">
                  {res.question}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Your Answer:</span>
                    <span className={res.is_correct ? 'text-emerald-800 font-medium' : 'text-rose-800 font-medium'}>
                      {res.user_answer || '(None)'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Correct Answer:</span>
                    <span className="text-emerald-800 font-medium">{res.correct_answer}</span>
                  </div>
                </div>

                {res.explanation && (
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">Explanation: </strong>
                    {res.explanation}
                  </div>
                )}

                {res.source_reference && (
                  <div className="p-2 rounded bg-slate-50 border border-slate-200 flex items-start justify-between gap-2 text-xs text-slate-600">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{res.source_reference.document}</span>
                        <span>· Page {res.source_reference.page}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 italic line-clamp-2">
                        "{res.source_reference.snippet}"
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        openEvidence({
                          documentId: '',
                          chunkId: `q-${idx}`,
                          documentName: res.source_reference?.document,
                          pageNumber: res.source_reference?.page,
                          snippet: res.source_reference?.snippet,
                        })
                      }
                      className="px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-200 shrink-0 inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Inspect</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Taking Quiz View */
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">
                Question {currentQuestionIdx + 1} of {totalQuestions}
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-mono text-slate-700">
                  {answeredCount} of {totalQuestions} answered
                </span>
                <span>·</span>
                <span className="capitalize">{currentQuiz.difficulty}</span>
              </div>
            </div>

            <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-slate-900 transition-all duration-300"
                style={{ width: `${((currentQuestionIdx + 1) / totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          {/* Active Question Card */}
          {currentQ && (
            <div className="p-6 rounded-lg bg-white border border-slate-200 shadow-xs space-y-5">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                {currentQ.question}
              </h3>

              <div className="space-y-2">
                {currentQ.options.map((option, optIdx) => {
                  const isSelected = userAnswers[String(currentQ.question_id)] === option;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectAnswer(currentQ.question_id, option)}
                      className={`w-full p-3 rounded-md text-left text-xs sm:text-sm border transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-slate-100 border-slate-900 text-slate-900 font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="leading-relaxed">{option}</span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                          isSelected ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
                  disabled={currentQuestionIdx === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                {currentQuestionIdx < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIdx((p) => p + 1)}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded font-medium text-white bg-slate-900 hover:bg-slate-800"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Grading...</span>
                      </>
                    ) : (
                      <span>Submit Quiz</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generator Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Generate Quiz</h3>
              <button
                onClick={() => setShowGenModal(false)}
                className="text-slate-400 hover:text-slate-800 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Source Documents ({activeDocuments.length} active)
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1 p-2 rounded bg-slate-50 border border-slate-200">
                  {activeDocuments.map((doc) => {
                    const isChecked = selectedDocIds.includes(doc.id);
                    return (
                      <label
                        key={doc.id}
                        className="flex items-center gap-2 p-1 text-slate-700 hover:text-slate-900 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedDocIds(selectedDocIds.filter((id) => id !== doc.id));
                            } else {
                              setSelectedDocIds([...selectedDocIds, doc.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-slate-900 focus:ring-0"
                        />
                        <span className="truncate">{doc.filename}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Questions
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 15, 25].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-medium border transition-colors ${
                        questionCount === num
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {num} Qs
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Difficulty
                </label>
                <div className="flex items-center gap-2">
                  {(['easy', 'medium', 'hard'] as FlashcardDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`flex-1 py-1 rounded capitalize text-xs font-medium border transition-colors ${
                        difficulty === diff
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateQuiz}
                disabled={generating || activeDocuments.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Preparing...</span>
                  </>
                ) : (
                  <span>Generate Quiz</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
