package controller

import (
	"testing"

	"gin-template/model"

	"github.com/google/uuid"
)

func TestGradeQuestionAlwaysCorrectAwardsFullPoints(t *testing.T) {
	question := model.QuizQuestion{
		QuestionType:  model.QuizQuestionSingle,
		Points:        4,
		AlwaysCorrect: true,
	}
	answer := model.QuizAnswer{
		ID:                uuid.New(),
		SelectedOptionIDs: []byte(`["not-the-correct-option"]`),
	}

	points, correct := gradeQuestion(question, answer)
	if !correct || points != question.Points {
		t.Fatalf("always-correct question = (%v, %v), want (%v, true)", points, correct, question.Points)
	}
}

func TestGradeQuestionAlwaysCorrectStillRequiresAnAnswer(t *testing.T) {
	question := model.QuizQuestion{
		QuestionType:  model.QuizQuestionShortAnswer,
		Points:        2,
		AlwaysCorrect: true,
	}

	points, correct := gradeQuestion(question, model.QuizAnswer{})
	if correct || points != 0 {
		t.Fatalf("unanswered always-correct question = (%v, %v), want (0, false)", points, correct)
	}
}

func TestHideQuestionCorrectAnswersHidesAlwaysCorrectRule(t *testing.T) {
	question := model.QuizQuestion{
		AlwaysCorrect: true,
		Options:       []model.QuizOption{{IsCorrect: true}},
	}

	hideQuestionCorrectAnswers(&question)
	if question.AlwaysCorrect || question.Options[0].IsCorrect {
		t.Fatalf("participant payload leaked grading rule: %+v", question)
	}
}
