import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CandidateEvaluationPage from "./page";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns all expand/collapse toggle buttons (they carry the "shrink-0" class). */
function getExpandButtons(container: HTMLElement) {
  return container.querySelectorAll<HTMLButtonElement>("button.shrink-0");
}

// ── rendering ────────────────────────────────────────────────────────────────

describe("CandidateEvaluationPage – rendering", () => {
  it("renders the page heading", () => {
    render(<CandidateEvaluationPage />);
    expect(
      screen.getByText("Candidate Evaluation Dashboard")
    ).toBeInTheDocument();
  });

  it("shows the default job title in the selector button", () => {
    render(<CandidateEvaluationPage />);
    expect(screen.getByText("Senior Software Engineer")).toBeInTheDocument();
  });

  it("shows SFIA mode label by default", () => {
    render(<CandidateEvaluationPage />);
    expect(screen.getByText("Top 20 Candidates")).toBeInTheDocument();
    expect(
      screen.getByText(/sorted by sfia pillar fit score/i)
    ).toBeInTheDocument();
  });

  it("renders the Top 20 Avg Fit stat block", () => {
    render(<CandidateEvaluationPage />);
    expect(screen.getByText("Top 20 Avg Fit")).toBeInTheDocument();
  });

  it("renders the three podium (top-3) candidate cards", () => {
    render(<CandidateEvaluationPage />);
    // Three Trophy icons are rendered inside podium divs — verify via their
    // parent containers which have specific bg classes set by podiumBg().
    const { container } = render(<CandidateEvaluationPage />);
    expect(container.querySelectorAll(".bg-amber-100").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll(".bg-slate-100").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll(".bg-orange-50").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a 'show all' toggle when there are more than 20 candidates", () => {
    render(<CandidateEvaluationPage />);
    expect(
      screen.getByRole("button", { name: /show all/i })
    ).toBeInTheDocument();
  });
});

// ── job selector ─────────────────────────────────────────────────────────────

describe("CandidateEvaluationPage – job selector", () => {
  it("opens the dropdown when the job button is clicked", () => {
    render(<CandidateEvaluationPage />);
    const jobBtn = screen.getByRole("button", { name: /senior software engineer/i });
    fireEvent.click(jobBtn);
    expect(screen.getByText("Product Manager")).toBeInTheDocument();
    expect(screen.getByText("UX Designer")).toBeInTheDocument();
  });

  it("selects a different job and updates the button label", () => {
    render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByRole("button", { name: /senior software engineer/i }));
    fireEvent.click(screen.getByText("Product Manager"));
    expect(
      screen.getByRole("button", { name: /product manager/i })
    ).toBeInTheDocument();
  });

  it("selects a third job (UX Designer)", () => {
    render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByRole("button", { name: /senior software engineer/i }));
    fireEvent.click(screen.getByText("UX Designer"));
    expect(
      screen.getByRole("button", { name: /ux designer/i })
    ).toBeInTheDocument();
  });
});

// ── ranking mode toggle ───────────────────────────────────────────────────────

describe("CandidateEvaluationPage – ranking mode", () => {
  it("switches to manual mode and shows the drag banner", () => {
    render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByText("Manual Ranking"));
    expect(screen.getByText(/drag-and-drop is active/i)).toBeInTheDocument();
  });

  it("shows Save Order button in manual mode", () => {
    render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByText("Manual Ranking"));
    expect(screen.getByRole("button", { name: /save order/i })).toBeInTheDocument();
  });

  it("clicking Save Order does not crash", () => {
    render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByText("Manual Ranking"));
    fireEvent.click(screen.getByRole("button", { name: /save order/i }));
    expect(screen.getByRole("button", { name: /save order/i })).toBeInTheDocument();
  });

  it("switches back from manual to SFIA mode", () => {
    render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByText("Manual Ranking"));
    fireEvent.click(screen.getByText("SFIA Ranking"));
    expect(
      screen.getByText(/sorted by sfia pillar fit score/i)
    ).toBeInTheDocument();
  });
});

// ── show all / show top 20 ────────────────────────────────────────────────────

describe("CandidateEvaluationPage – show all toggle", () => {
  it("shows all candidates when toggle is clicked", () => {
    render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.getByText(/all \d+ candidates/i)).toBeInTheDocument();
  });

  it("reverts to top 20 when toggle is clicked again", () => {
    render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    fireEvent.click(screen.getByRole("button", { name: /show top 20 only/i }));
    expect(screen.getByText("Top 20 Candidates")).toBeInTheDocument();
  });
});

// ── candidate card expand / collapse ─────────────────────────────────────────

describe("CandidateEvaluationPage – card expand", () => {
  it("expands a candidate card to reveal SFIA pillar visualization", () => {
    const { container } = render(<CandidateEvaluationPage />);
    const expandBtns = getExpandButtons(container);
    expect(expandBtns.length).toBeGreaterThan(0);
    fireEvent.click(expandBtns[0]);
    expect(
      screen.getByText(/skill demand vs supply/i)
    ).toBeInTheDocument();
  });

  it("collapses the card when the toggle is clicked again", () => {
    const { container } = render(<CandidateEvaluationPage />);
    const expandBtns = getExpandButtons(container);
    fireEvent.click(expandBtns[0]);
    expect(screen.getByText(/skill demand vs supply/i)).toBeInTheDocument();
    fireEvent.click(expandBtns[0]);
    expect(screen.queryByText(/skill demand vs supply/i)).not.toBeInTheDocument();
  });
});

// ── drag-and-drop (manual mode) ───────────────────────────────────────────────

describe("CandidateEvaluationPage – drag and drop", () => {
  it("handles drag start, drag over, drop, and drag end without crashing", () => {
    const { container } = render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByText("Manual Ranking"));

    const draggables = container.querySelectorAll<HTMLDivElement>("[draggable='true']");
    expect(draggables.length).toBeGreaterThan(1);

    fireEvent.dragStart(draggables[0]);
    fireEvent.dragOver(draggables[1]);
    fireEvent.drop(draggables[1]);
    fireEvent.dragEnd(draggables[0]);

    // After reorder, the page should still render the list heading
    expect(screen.getByText(/manual mode/i)).toBeInTheDocument();
  });

  it("drag over the same card (no-op drop guard) does not crash", () => {
    const { container } = render(<CandidateEvaluationPage />);
    fireEvent.click(screen.getByText("Manual Ranking"));

    const draggables = container.querySelectorAll<HTMLDivElement>("[draggable='true']");
    fireEvent.dragStart(draggables[0]);
    fireEvent.drop(draggables[0]); // same index → guarded by dragIndex === toIndex
    fireEvent.dragEnd(draggables[0]);

    expect(screen.getByText(/manual mode/i)).toBeInTheDocument();
  });
});
