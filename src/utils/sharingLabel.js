export function sharingLabel(t, sharing) {
  return {
    school: t.schoolShared,
    private: t.private,
    project: t.projectShared,
    university: t.universityShared,
  }[sharing] || sharing;
}
