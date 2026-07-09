const GRADE_CLASS = {
  Display: "grade-a-plus",
  Monitor: "grade-b",
  Ignore: "grade-ignore",
};

export default function GradeBadge({ grade }) {
  return <span className={`grade-badge ${GRADE_CLASS[grade] || "grade-b"}`}>{grade}</span>;
}
