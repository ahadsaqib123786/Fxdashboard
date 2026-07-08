const GRADE_CLASS = {
  "A+": "grade-a-plus",
  A: "grade-a",
  B: "grade-b",
  Ignore: "grade-ignore",
};

export default function GradeBadge({ grade }) {
  return <span className={`grade-badge ${GRADE_CLASS[grade] || "grade-b"}`}>{grade}</span>;
}
