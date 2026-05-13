export const utils = {
  DictIntersection(dictA: Record<string, unknown>, dictB: Record<string, unknown>) {
    const intersection: Record<string, unknown> = {};
    for (const k in dictB) {
      if (k in dictA) {
        intersection[k] = dictA[k];
      }
    }
    return intersection;
  },

  DictDifference(dictA: Record<string, unknown>, dictB: Record<string, unknown>) {
    const diff = { ...dictA };
    for (const k in dictB) {
      delete diff[k];
    }
    return diff;
  },
};
