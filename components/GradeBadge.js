const GRADE_CLASS = {
  "Institutional Setup Available": "grade-a-plus",
  "Awaiting Confirmation": "grade-b",
  "Setup Building": "grade-b",
  "Wait": "grade-ignore",
  "Invalidated": "grade-ignore",
};

export default function GradeBadge({ grade }) {
  return <span className={`grade-badge ${GRADE_CLASS[grade] || "grade-b"}`}>{grade}</span>;
}
