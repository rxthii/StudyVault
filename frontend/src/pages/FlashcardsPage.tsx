import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Loader2,
  FileText,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import {
  generateFlashcards,
  getFlashcardSets,
  deleteFlashcardSet,
  reviewFlashcard,
} from '../api/flashcards.ts';
import type {
  FlashcardCard,
  FlashcardDifficulty,
  FlashcardSet,
  ReviewStatus,
} from '../types/index.ts';

export const FlashcardsPage: React.FC = () => {
  const { activeDocuments, showToast, openEvidence } = useApp();

  const [decks, setDecks] = useState<FlashcardSet[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<FlashcardSet | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [loadingDecks, setLoadingDecks] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);

  // Deck generation configuration state
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [cardCount, setCardCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<FlashcardDifficulty>('medium');
  const [showGenModal, setShowGenModal] = useState<boolean>(false);

  const fetchDecks = async () => {
    try {
      setLoadingDecks(true);
      const res = await getFlashcardSets();
      setDecks(res);
      if (res.length > 0 && !selectedDeck) {
        setSelectedDeck(res[0]);
        setCurrentCardIndex(0);
        setIsAnswerRevealed(false);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load flashcard decks.');
    } finally {
      setLoadingDecks(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const handleGenerateDeck = async () => {
    if (activeDocuments.length === 0) {
      showToast('error', 'No active documents! Link at least one document first.');
      return;
    }

    try {
      setGenerating(true);
      const newDeck = await generateFlashcards({
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : null,
        count: cardCount,
        difficulty,
      });

      showToast('success', `Generated deck with ${newDeck.cards.length} cards.`);
      setDecks((prev) => [newDeck, ...prev]);
      setSelectedDeck(newDeck);
      setCurrentCardIndex(0);
      setIsAnswerRevealed(false);
      setShowGenModal(false);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to generate flashcards.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    try {
      await deleteFlashcardSet(deckId);
      showToast('success', 'Deck removed.');
      const updated = decks.filter((d) => d.id !== deckId);
      setDecks(updated);
      if (selectedDeck?.id === deckId) {
        setSelectedDeck(updated.length > 0 ? updated[0] : null);
        setCurrentCardIndex(0);
        setIsAnswerRevealed(false);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete deck.');
    }
  };

  const handleReview = async (status: ReviewStatus) => {
    if (!selectedDeck || !selectedDeck.cards[currentCardIndex]) return;
    const currentCard = selectedDeck.cards[currentCardIndex];

    try {
      await reviewFlashcard(currentCard.id, status);

      const updatedCards = [...selectedDeck.cards];
      updatedCards[currentCardIndex] = {
        ...currentCard,
        review_status: status,
      };

      const updatedDeck = {
        ...selectedDeck,
        cards: updatedCards,
      };

      setSelectedDeck(updatedDeck);
      setDecks((prev) => prev.map((d) => (d.id === updatedDeck.id ? updatedDeck : d)));

      if (currentCardIndex < selectedDeck.cards.length - 1) {
        setCurrentCardIndex((prev) => prev + 1);
        setIsAnswerRevealed(false);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to record card review.');
    }
  };

  const currentCard: FlashcardCard | undefined = selectedDeck?.cards[currentCardIndex];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <button
        id="trigger-generate-flashcards"
        onClick={() => setShowGenModal(true)}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Active Recall Flashcards
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Spaced retrieval practice grounded in your uploaded documents.
          </p>
        </div>

        <button
          onClick={() => setShowGenModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs whitespace-nowrap"
        >
          <span>Generate Deck</span>
        </button>
      </div>

      {/* Deck Selector Tabs */}
      {decks.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
          {decks.map((deck) => {
            const isSelected = selectedDeck?.id === deck.id;
            const knownCount = deck.cards.filter((c) => c.review_status === 'known').length;

            return (
              <div
                key={deck.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-white border-slate-400 text-slate-900 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                }`}
                onClick={() => {
                  setSelectedDeck(deck);
                  setCurrentCardIndex(0);
                  setIsAnswerRevealed(false);
                }}
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>{deck.title || 'Flashcard Deck'}</span>
                <span className="font-mono text-[10px] text-slate-400">
                  ({knownCount}/{deck.cards.length} known)
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDeck(deck.id);
                  }}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded ml-1"
                  title="Delete deck"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Flashcard Practice Area */}
      {loadingDecks ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-slate-700 mb-2" />
          <span className="text-xs">Loading flashcards...</span>
        </div>
      ) : !selectedDeck || selectedDeck.cards.length === 0 ? (
        <div className="p-10 text-center rounded-lg bg-white border border-slate-200 max-w-md mx-auto space-y-3">
          <Layers className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No Flashcard Decks Yet</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Generate flashcard questions from your active lecture notes or textbook chapters.
          </p>
          <button
            onClick={() => setShowGenModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            <span>Generate Flashcards</span>
          </button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Deck Stats & Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">
                Card {currentCardIndex + 1} of {selectedDeck.cards.length}
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-700 font-mono">
                  {selectedDeck.cards.filter((c) => c.review_status === 'known').length} known
                </span>
                <span>·</span>
                <span className="text-amber-700 font-mono">
                  {selectedDeck.cards.filter((c) => c.review_status === 'review_again').length} review again
                </span>
                <span>·</span>
                <span className="capitalize text-slate-600">{selectedDeck.difficulty}</span>
              </div>
            </div>

            <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-slate-900 transition-all duration-300"
                style={{
                  width: `${((currentCardIndex + 1) / selectedDeck.cards.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Clean Index Card */}
          {currentCard && (
            <div className="min-h-72 rounded-lg bg-white border border-slate-200 p-8 flex flex-col justify-between shadow-xs transition-all">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                <span className="font-mono uppercase text-[11px] font-semibold text-slate-500">
                  {isAnswerRevealed ? 'Answer & Source' : 'Question'}
                </span>
                <span className="text-[11px] font-mono text-slate-500 capitalize">
                  {currentCard.review_status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-center my-4 space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 text-center leading-relaxed">
                  {currentCard.question}
                </h3>

                {isAnswerRevealed && (
                  <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-800">
                      Answer:
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {currentCard.answer}
                    </p>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 truncate max-w-xs">
                        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{currentCard.document_name}</span>
                        <span>· Page {currentCard.page_number}</span>
                      </div>
                      <button
                        onClick={() =>
                          openEvidence({
                            documentId: currentCard.document_id,
                            chunkId: currentCard.source_chunk_id,
                            documentName: currentCard.document_name,
                            pageNumber: currentCard.page_number,
                            snippet: currentCard.answer,
                          })
                        }
                        className="text-blue-700 hover:underline font-medium inline-flex items-center gap-1 shrink-0"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Evidence</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Controls */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                {!isAnswerRevealed ? (
                  <button
                    onClick={() => setIsAnswerRevealed(true)}
                    className="w-full py-2.5 rounded-md font-medium text-xs text-white bg-slate-900 hover:bg-slate-800 transition-colors"
                  >
                    Reveal Answer
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => handleReview('review_again')}
                      className="py-2 px-3 rounded-md font-medium text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Review Again</span>
                    </button>
                    <button
                      onClick={() => handleReview('known')}
                      className="py-2 px-3 rounded-md font-medium text-xs text-white bg-slate-900 hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Know It</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stepper navigation */}
          <div className="flex items-center justify-between text-xs">
            <button
              onClick={() => {
                if (currentCardIndex > 0) {
                  setCurrentCardIndex((prev) => prev - 1);
                  setIsAnswerRevealed(false);
                }
              }}
              disabled={currentCardIndex === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="font-mono text-slate-400">
              {currentCardIndex + 1} / {selectedDeck.cards.length}
            </span>

            <button
              onClick={() => {
                if (currentCardIndex < selectedDeck.cards.length - 1) {
                  setCurrentCardIndex((prev) => prev + 1);
                  setIsAnswerRevealed(false);
                }
              }}
              disabled={currentCardIndex === selectedDeck.cards.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Generator Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Generate Flashcard Deck</h3>
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
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Leave unselected to generate across all active documents.
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Card Count
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCardCount(num)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-medium border transition-colors ${
                        cardCount === num
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {num}
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
                onClick={handleGenerateDeck}
                disabled={generating || activeDocuments.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <span>Generate Deck</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
